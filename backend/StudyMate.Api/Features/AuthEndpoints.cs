using System.Net.Mail;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;
using MailMessage = StudyMate.Api.Domain.MailMessage;

namespace StudyMate.Api.Features;

public sealed record Credentials(string Email, string Password);
public sealed record EmailRequest(string Email);
public sealed record TokenRequest(string Token);
public sealed record ResetRequest(string Token, string Password);

public static class AuthEndpoints
{
    private static object Accepted => new { message = "إذا كان البريد مؤهلًا، ستصلك رسالة لإكمال العملية." };
    private static string Email(string value)
    {
        var email = Validate.Text(value, 254, "email").ToLowerInvariant();
        if (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email) throw ApiException.Invalid("أدخل بريدًا إلكترونيًا صالحًا.", "email");
        return email;
    }
    private static void Password(string? password)
    { if (password is null || password.Length is < 8 or > 128) throw ApiException.Invalid("كلمة المرور بين 8 و128 محرفًا.", "password"); }

    public static void MapAuth(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth").RequireRateLimiting("auth");
        group.MapPost("/firebase", async (HttpContext context, AppDb db, IPasswordHasher<User> hasher) =>
        {
            if (context.User.Identity?.IsAuthenticated != true) throw new ApiException(401, "unauthorized", "سجّل الدخول وأكّد بريدك الإلكتروني أولًا.");
            var uid = context.User.FindFirst("sub")!.Value;
            var email = Email(context.User.FindFirst("email")?.Value ?? "");
            var user = await db.Users.SingleOrDefaultAsync(u => u.FirebaseUid == uid);
            if (user == null)
            {
                user = await db.Users.SingleOrDefaultAsync(u => u.Email == email);
                // The validated Firebase token proves email ownership, including for a pending legacy registration.
                // Preserve student data, but never relink another UID or reactivate disabled accounts.
                if (user != null && (user.FirebaseUid != null || user.Role != "student" || !user.Active || user.DeletedAt != null))
                    throw new ApiException(409, "account_link_required", "هذا البريد مرتبط بحساب سابق يحتاج مراجعة قبل الربط. لم تتغير بياناته.");
                if (user == null)
                {
                    user = new User { Email = email, Verified = true };
                    user.PasswordHash = hasher.HashPassword(user, Secrets.NewToken());
                    db.Users.Add(user);
                }
                user.FirebaseUid = uid;
                user.Verified = true;
                db.Sessions.RemoveRange(await db.Sessions.Where(s => s.UserId == user.Id).ToListAsync());
                db.AccountTokens.RemoveRange(await db.AccountTokens.Where(t => t.UserId == user.Id).ToListAsync());
                await db.SaveChangesAsync();
            }
            if (!user.Active || user.DeletedAt != null || !user.Verified) throw new ApiException(403, "forbidden", "هذا الحساب غير متاح.");
            return Results.Ok(Profile(user));
        });
        group.MapPost("/register", async (Credentials request, AppDb db, IPasswordHasher<User> hasher, IDataProtectionProvider protection, IConfiguration config, TimeProvider clock) =>
        {
            var email = Email(request.Email); Password(request.Password);
            if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Accepted(value: Accepted);
            var user = new User { Email = email }; user.PasswordHash = hasher.HashPassword(user, request.Password);
            db.Users.Add(user);
            QueueToken(db, protection, config, clock, user, "verify");
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException e) when (e.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
            { return Results.Accepted(value: Accepted); }
            return Results.Accepted(value: Accepted);
        });
        group.MapPost("/verify", async (TokenRequest request, AppDb db, TimeProvider clock) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var token = await ValidToken(db, clock, request.Token, "verify");
            var user = await db.Users.SingleAsync(u => u.Id == token.UserId);
            if (!user.Active || user.DeletedAt != null) throw InvalidToken();
            user.Verified = true; token.UsedAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Ok(new { message = "تم التحقق من البريد. يمكنك تسجيل الدخول." });
        });
        group.MapPost("/resend-verification", async (EmailRequest request, AppDb db, IDataProtectionProvider protection, IConfiguration config, TimeProvider clock) =>
        {
            var email = Email(request.Email);
            var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email && u.Active && u.DeletedAt == null);
            if (user is { Verified: false }) { QueueToken(db, protection, config, clock, user, "verify"); await db.SaveChangesAsync(); }
            return Results.Accepted(value: Accepted);
        });
        group.MapPost("/login", async (Credentials request, AppDb db, IPasswordHasher<User> hasher, TimeProvider clock) =>
        {
            var email = Email(request.Email); Password(request.Password);
            var now = clock.GetUtcNow().UtcDateTime;
            var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email);
            var failure = new ApiException(401, "unauthorized", "تعذّر تسجيل الدخول. تحقق من بياناتك وتفعيل البريد.");
            if (user == null)
            {
                // A real password hash calculation also occurs for unknown emails.
                hasher.HashPassword(new User(), request.Password);
                throw failure;
            }
            if (user.LockedUntil > now || user.FirebaseUid != null) throw failure;
            var valid = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
            if (valid == PasswordVerificationResult.Failed || !user.Verified || !user.Active || user.DeletedAt != null)
            {
                if (user.FailureWindowStart == null || user.FailureWindowStart < now.AddMinutes(-15))
                { user.FailureWindowStart = now; user.FailedSignIns = 0; }
                if (++user.FailedSignIns >= 10) user.LockedUntil = now.AddMinutes(15);
                await db.SaveChangesAsync(); throw failure;
            }
            user.FailedSignIns = 0; user.FailureWindowStart = null; user.LockedUntil = null;
            if (valid == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, request.Password);
            var raw = Secrets.NewToken(); var expires = now.AddDays(7);
            db.Sessions.Add(new Session { UserId = user.Id, TokenHash = Secrets.Hash(raw), ExpiresAt = expires });
            await db.SaveChangesAsync();
            return Results.Ok(new { token = raw, expiresAt = expires, user = Profile(user) });
        });
        group.MapPost("/forgot-password", async (EmailRequest request, AppDb db, IDataProtectionProvider protection, IConfiguration config, TimeProvider clock) =>
        {
            var email = Email(request.Email);
            var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email && u.Active && u.Verified && u.DeletedAt == null);
            if (user != null) { QueueToken(db, protection, config, clock, user, "reset"); await db.SaveChangesAsync(); }
            return Results.Accepted(value: Accepted);
        });
        group.MapPost("/reset-password", async (ResetRequest request, AppDb db, TimeProvider clock, IPasswordHasher<User> hasher) =>
        {
            Password(request.Password);
            await using var tx = await db.Database.BeginTransactionAsync();
            var token = await ValidToken(db, clock, request.Token, "reset");
            var now = clock.GetUtcNow().UtcDateTime;
            var consumed = await db.AccountTokens.Where(t => t.Id == token.Id && t.UsedAt == null && t.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now));
            if (consumed != 1) throw InvalidToken();
            var user = await db.Users.SingleOrDefaultAsync(u => u.Id == token.UserId && u.Active && u.DeletedAt == null) ?? throw InvalidToken();
            user.PasswordHash = hasher.HashPassword(user, request.Password);
            user.FailedSignIns = 0; user.LockedUntil = null; user.FailureWindowStart = null;
            await db.AccountTokens.Where(t => t.UserId == user.Id && t.Purpose == "reset" && t.UsedAt == null).ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now));
            db.Sessions.RemoveRange(await db.Sessions.Where(s => s.UserId == user.Id).ToListAsync());
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Ok(new { message = "تم تغيير كلمة المرور وإغلاق الجلسات السابقة." });
        });
        endpoints.MapGet("/api/me", async (AppDb db, CurrentUser actor) =>
        {
            if (actor.Id == null) throw new ApiException(401, "unauthorized", "سجّل الدخول أولًا.");
            return Profile(await db.Users.AsNoTracking().SingleAsync(x => x.Id == actor.Id));
        });
        endpoints.MapPost("/api/auth/logout", async (AppDb db, CurrentUser actor) =>
        {
            if (actor.SessionId != null) await db.Sessions.Where(x => x.Id == actor.SessionId).ExecuteDeleteAsync();
            return Results.NoContent();
        });
    }

    public static object Profile(User user) => new { user.Id, user.Email, user.Role, user.Language, user.Verified };
    private static ApiException InvalidToken() => ApiException.Invalid("الرابط غير صالح أو منتهي أو مستخدم.", "token");
    private static async Task<AccountToken> ValidToken(AppDb db, TimeProvider clock, string value, string purpose)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 100) throw InvalidToken();
        var hash = Secrets.Hash(value); var now = clock.GetUtcNow().UtcDateTime;
        return await db.AccountTokens.SingleOrDefaultAsync(x => x.TokenHash == hash && x.Purpose == purpose && x.UsedAt == null && x.ExpiresAt > now) ?? throw InvalidToken();
    }
    private static void QueueToken(AppDb db, IDataProtectionProvider protection, IConfiguration config, TimeProvider clock, User user, string purpose)
    {
        var token = Secrets.NewToken(); var now = clock.GetUtcNow().UtcDateTime;
        db.AccountTokens.Add(new AccountToken { UserId = user.Id, Purpose = purpose, TokenHash = Secrets.Hash(token), ExpiresAt = purpose == "verify" ? now.AddHours(24) : now.AddMinutes(30) });
        var baseUrl = config["PublicWebUrl"]!.TrimEnd('/');
        var link = $"{baseUrl}/?action={purpose}&token={token}";
        var body = purpose == "verify" ? $"للتحقق من بريدك في StudyMate افتح الرابط التالي خلال 24 ساعة:\n{link}" : $"لاستعادة كلمة المرور في StudyMate افتح الرابط التالي خلال 30 دقيقة:\n{link}";
        db.MailMessages.Add(new MailMessage { Recipient = user.Email, Subject = "StudyMate - " + (purpose == "verify" ? "التحقق من البريد" : "استعادة كلمة المرور"), ProtectedBody = protection.CreateProtector("StudyMate.Mail.v1").Protect(body) });
    }
}
