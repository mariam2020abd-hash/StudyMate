using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

namespace StudyMate.Api.Features;

public sealed record GenerationRequest(string Kind, string Language, Guid RequestKey);

public static class GenerationEndpoints
{
    public static void MapGeneration(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.StudentGroup();
        group.MapGet("/quota", async (AppDb db, TimeProvider clock, IStudyGenerator generator) =>
        {
            var day = RiyadhDay(clock.GetUtcNow().UtcDateTime);
            var usage = await db.Usage.SingleOrDefaultAsync(x => x.Day == day);
            var limit = await db.Settings.Select(x => x.DailyQuota).SingleAsync();
            return new { day, limit, generationAvailable = generator.Configured, used = usage?.Used ?? 0, reserved = usage?.Reserved ?? 0,
                remaining = Math.Max(0, limit - (usage?.Used ?? 0) - (usage?.Reserved ?? 0)), resetsAt = day.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(-3) };
        });
        group.MapPost("/chapters/{chapterId:guid}/generations", async (Guid chapterId, GenerationRequest request, AppDb db, CurrentUser actor, TimeProvider clock, IStudyGenerator generator) =>
        {
            var owner = actor.RequireStudent();
            if (request.Kind is not ("explanation" or "summary" or "quiz") || request.RequestKey == Guid.Empty)
                throw ApiException.Invalid("اختر نوع المحتوى وأرسل معرف طلب صالحًا.");
            var language = Validate.Language(request.Language);
            await using var tx = await db.Database.BeginTransactionAsync();
            // Serialize reservations for this account, including its first quota row. Other students remain independent.
            var user = await db.Users.FromSqlInterpolated($"SELECT * FROM Users WITH (UPDLOCK, ROWLOCK) WHERE Id = {owner}").SingleAsync();
            if (!user.Active || user.DeletedAt != null) throw new ApiException(401, "unauthorized", "سجّل الدخول أولًا.");
            var existing = await db.Jobs.SingleOrDefaultAsync(x => x.RequestKey == request.RequestKey);
            if (existing != null)
            {
                if (existing.ChapterId != chapterId || existing.Kind != request.Kind || existing.Language != language) throw ApiException.Conflict();
                await tx.CommitAsync(); return Results.Ok(View(existing));
            }
            var source = await db.Sources.Where(s => s.ChapterId == chapterId).Select(s => new { s.Id, s.Status }).SingleOrDefaultAsync() ?? throw ApiException.NotFound();
            if (source.Status != "ready") throw new ApiException(409, "source_not_ready", "انتظر اكتمال استخراج نص الشابتر.");
            if (!generator.Configured) throw new ApiException(503, "generation_unavailable", "خدمة التوليد غير متاحة حاليًا. لم تُستهلك حصتك.");
            var settings = await db.Settings.SingleAsync(); var now = clock.GetUtcNow().UtcDateTime; var day = RiyadhDay(now);
            var usage = await db.Usage.SingleOrDefaultAsync(x => x.Day == day);
            if (usage == null) { usage = new DailyUsage { OwnerId = owner, Day = day }; db.Usage.Add(usage); }
            if (usage.Used + usage.Reserved >= settings.DailyQuota) throw new ApiException(429, "quota_exhausted", "نفدت حصة التوليد اليومية. تبقى مخرجاتك السابقة متاحة.");
            usage.Reserved++;
            var job = new GenerationJob { OwnerId = owner, ChapterId = chapterId, SourceId = source.Id, Kind = request.Kind, Language = language,
                QuestionCount = settings.QuizQuestions, RequestKey = request.RequestKey, QuotaDay = day, CreatedAt = now, Deadline = now.AddSeconds(180) };
            db.Jobs.Add(job); await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Accepted($"/api/study/generations/{job.Id}", View(job));
        });
        group.MapGet("/chapters/{id:guid}/generations", async (Guid id, AppDb db) =>
        {
            if (!await db.Chapters.AnyAsync(c => c.Id == id)) throw ApiException.NotFound();
            return await db.Jobs.Where(j => j.ChapterId == id).OrderByDescending(j => j.CreatedAt)
                .Select(j => new { j.Id, j.Kind, j.Language, j.Status, j.ErrorCode, j.CreatedAt, j.CompletedAt }).ToListAsync();
        });
        group.MapGet("/generations/{id:guid}", async (Guid id, AppDb db) => View(await db.Jobs.SingleOrDefaultAsync(j => j.Id == id) ?? throw ApiException.NotFound()));
    }

    public static DateOnly RiyadhDay(DateTime utc) => DateOnly.FromDateTime(utc.AddHours(3));
    public static object View(GenerationJob job)
    {
        object? result = null;
        if (job.Status == "completed")
        {
            var content = JsonSerializer.Deserialize<GenerationDocument>(job.ResultJson, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
            result = job.Kind == "quiz"
                ? new { questions = content.Questions.Select((q, index) => new { id = index, q.Kind, q.Prompt, q.Choices }) } as object
                : new { content.Sections };
        }
        return new { job.Id, job.ChapterId, job.SourceId, job.Kind, job.Language, job.Status, job.ErrorCode, job.CreatedAt, job.CompletedAt, result };
    }
}
