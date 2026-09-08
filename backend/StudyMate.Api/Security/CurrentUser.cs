using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Infrastructure;

namespace StudyMate.Api.Security;

public sealed class CurrentUser
{
    public Guid? Id { get; set; }
    public Guid? SessionId { get; set; }
    public string? Role { get; set; }
    public Guid RequireStudent()
    {
        if (Id is null) throw new ApiException(401, "unauthorized", "سجّل الدخول أولًا.");
        if (Role != "student") throw new ApiException(403, "forbidden", "هذه الوظيفة متاحة للطالب فقط.");
        return Id.Value;
    }
    public Guid RequireAdmin()
    {
        if (Id is null) throw new ApiException(401, "unauthorized", "سجّل الدخول أولًا.");
        if (Role != "admin") throw new ApiException(403, "forbidden", "ليست لديك صلاحية الإدارة.");
        return Id.Value;
    }
}

public static class Secrets
{
    public static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public sealed class SessionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AppDb db, CurrentUser actor, TimeProvider clock)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) && header.Length <= 100)
        {
            var hash = Secrets.Hash(header[7..]);
            var now = clock.GetUtcNow().UtcDateTime;
            var session = await (from s in db.Sessions.AsNoTracking()
                                 join u in db.Users.AsNoTracking() on s.UserId equals u.Id
                                 where s.TokenHash == hash && s.ExpiresAt > now && u.Active && u.Verified && u.DeletedAt == null
                                 select new { s.Id, s.UserId, u.Role }).SingleOrDefaultAsync(context.RequestAborted);
            if (session != null) { actor.Id = session.UserId; actor.Role = session.Role; actor.SessionId = session.Id; }
        }
        await next(context);
    }
}
