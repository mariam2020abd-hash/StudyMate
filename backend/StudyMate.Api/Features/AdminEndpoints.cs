using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

namespace StudyMate.Api.Features;

public sealed record AccountStateRequest(bool Active, long Version, string Reason);
public sealed record SettingsRequest(int DailyQuota, int MaxPdfBytes, int MaxPdfPages, int QuizQuestions, long Version, string Reason);
public sealed record ScaleRequest(string Name, decimal Maximum, Dictionary<string, decimal> Points, string SourceUrl, string Reason);

public static class AdminEndpoints
{
    public static void MapAdmin(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin");
        group.AddEndpointFilter(async (ctx, next) =>
        { ctx.HttpContext.RequestServices.GetRequiredService<CurrentUser>().RequireAdmin(); return await next(ctx); });
        group.MapGet("/accounts", async (string? query, AppDb db) =>
        {
            var q = (query ?? "").Trim();
            if (q.Length > 254) throw ApiException.Invalid("نص البحث أطول من الحد المسموح.");
            var users = db.Users.AsNoTracking().Where(u => u.DeletedAt == null);
            if (q.Length > 0) users = Guid.TryParse(q, out var id) ? users.Where(u => u.Id == id) : users.Where(u => u.Email.Contains(q));
            return await users.OrderBy(u => u.Email).Take(100).Select(u => new { u.Id, u.Email, u.Role, u.Active, u.Verified, u.Version, u.CreatedAt }).ToListAsync();
        });
        group.MapPut("/accounts/{id:guid}/state", async (Guid id, AccountStateRequest r, AppDb db, CurrentUser actor) =>
        {
            var admin = actor.RequireAdmin();
            if (id == admin) throw ApiException.Invalid("لا يمكنك تعطيل حسابك الإداري.");
            var reason = Validate.Text(r.Reason, 500, "reason");
            await using var tx = await db.Database.BeginTransactionAsync();
            var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id && u.DeletedAt == null) ?? throw ApiException.NotFound();
            Validate.Version(user, r.Version);
            if (user.Role == "admin") throw ApiException.Invalid("إدارة المشرفين تتم عبر أداة التشغيل فقط.");
            var before = new { user.Active }; user.Active = r.Active;
            if (!r.Active) db.Sessions.RemoveRange(await db.Sessions.Where(s => s.UserId == id).ToListAsync());
            Audit(db, admin, "account.state", id, reason, before, new { user.Active });
            await db.SaveChangesAsync(); await tx.CommitAsync(); return new { user.Id, user.Active, user.Version };
        });
        group.MapGet("/settings", async (AppDb db) => await db.Settings.SingleAsync());
        group.MapPut("/settings", async (SettingsRequest r, AppDb db, CurrentUser actor) =>
        {
            if (r.DailyQuota is < 1 or > 1000 || r.MaxPdfBytes is < 1 or > 20_000_000 || r.MaxPdfPages is < 1 or > 100 || r.QuizQuestions != 10)
                throw ApiException.Invalid("أدخل حدودًا موجبة ضمن قدرة التجربة: 20 MB و100 صفحة و10 أسئلة.");
            var reason = Validate.Text(r.Reason, 500, "reason");
            var settings = await db.Settings.SingleAsync(); Validate.Version(settings, r.Version);
            var before = new { settings.DailyQuota, settings.MaxPdfBytes, settings.MaxPdfPages, settings.QuizQuestions };
            settings.DailyQuota = r.DailyQuota; settings.MaxPdfBytes = r.MaxPdfBytes; settings.MaxPdfPages = r.MaxPdfPages; settings.QuizQuestions = r.QuizQuestions;
            Audit(db, actor.RequireAdmin(), "settings.update", settings.Id, reason, before, new { settings.DailyQuota, settings.MaxPdfBytes, settings.MaxPdfPages, settings.QuizQuestions });
            await db.SaveChangesAsync(); return settings;
        });
        group.MapGet("/scales", async (AppDb db) => (await db.Scales.OrderByDescending(s => s.CreatedAt).ToListAsync()).Select(s => new { scale = GpaEndpoints.ScaleView(s), s.Active }));
        group.MapPost("/scales", async (ScaleRequest r, AppDb db, CurrentUser actor) =>
        {
            var reason = Validate.Text(r.Reason, 500, "reason"); var name = Validate.Text(r.Name, 100, "name");
            if (r.Maximum is <= 0 or > 10 || r.Points.Count != GpaCalculator.HailPoints.Count || !GpaCalculator.HailPoints.Keys.All(r.Points.ContainsKey) || r.Points.Values.Any(v => v < 0 || v > r.Maximum))
                throw ApiException.Invalid("أدخل سلمًا كاملًا بالأوزان الصحيحة.", "points");
            if (!Uri.TryCreate(r.SourceUrl, UriKind.Absolute, out var source) || source.Scheme != "https") throw ApiException.Invalid("أدخل رابط المصدر الرسمي عبر HTTPS.", "sourceUrl");
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var previous = await db.Scales.SingleAsync(s => s.Active); previous.Active = false;
            var scale = new GradingScale { Name = name, Maximum = r.Maximum, PointsJson = JsonSerializer.Serialize(r.Points), SourceUrl = source.ToString() };
            db.Scales.Add(scale);
            Audit(db, actor.RequireAdmin(), "scale.create", scale.Id, reason, GpaEndpoints.ScaleView(previous), GpaEndpoints.ScaleView(scale));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Created($"/api/admin/scales/{scale.Id}", GpaEndpoints.ScaleView(scale));
        });
        group.MapGet("/audit", async (AppDb db) => await db.AuditEvents.AsNoTracking().OrderByDescending(a => a.CreatedAt).Take(100).ToListAsync());
    }
    public static void Audit(AppDb db, Guid actor, string action, Guid target, string reason, object before, object after) =>
        db.AuditEvents.Add(new AuditEvent { ActorId = actor, Action = action, TargetId = target, Reason = reason, BeforeJson = JsonSerializer.Serialize(before), AfterJson = JsonSerializer.Serialize(after) });
}
