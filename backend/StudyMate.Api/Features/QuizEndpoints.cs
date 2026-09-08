using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

namespace StudyMate.Api.Features;

public sealed record AttemptRequest(Guid RequestKey);
public sealed record AnswerRequest(Dictionary<int,int?> Answers, long Version);
public sealed record SubmitRequest(Guid RequestKey, long Version, bool ConfirmUnanswered);

public static class QuizEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public static void MapQuiz(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.StudentGroup();
        group.MapPost("/generations/{id:guid}/attempts", async (Guid id, AttemptRequest r, AppDb db, CurrentUser actor) =>
        {
            if (r.RequestKey == Guid.Empty) throw ApiException.Invalid("معرف المحاولة مطلوب.");
            var owner = actor.RequireStudent();
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Users.FromSqlInterpolated($"SELECT * FROM Users WITH (UPDLOCK, ROWLOCK) WHERE Id = {owner}").SingleAsync();
            var job = await Quiz(db,id);
            var previous = await db.Attempts.SingleOrDefaultAsync(a => a.RequestKey == r.RequestKey);
            if (previous != null)
            {
                if (previous.JobId != id) throw ApiException.Conflict();
                await tx.CommitAsync(); return Results.Ok(View(previous,job));
            }
            var questions = Content(job).Questions;
            var attempt = new QuizAttempt { OwnerId = owner, JobId = id, RequestKey = r.RequestKey, Total = questions.Length };
            db.Attempts.Add(attempt); await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Created($"/api/study/attempts/{attempt.Id}", View(attempt,job));
        });
        group.MapGet("/generations/{id:guid}/attempts", async (Guid id, AppDb db) =>
        {
            await Quiz(db,id);
            return await db.Attempts.Where(a=>a.JobId==id).OrderByDescending(a=>a.CreatedAt)
                .Select(a=>new { a.Id,a.Version,a.CreatedAt,a.SubmittedAt,a.CorrectCount,a.Total }).ToListAsync();
        });
        group.MapGet("/attempts/{id:guid}", async (Guid id, AppDb db) =>
        {
            var attempt = await db.Attempts.SingleOrDefaultAsync(a=>a.Id==id) ?? throw ApiException.NotFound();
            return View(attempt,await Quiz(db,attempt.JobId));
        });
        group.MapPut("/attempts/{id:guid}/answers", async (Guid id, AnswerRequest r, AppDb db) =>
        {
            var attempt = await db.Attempts.SingleOrDefaultAsync(a=>a.Id==id) ?? throw ApiException.NotFound();
            Validate.Version(attempt,r.Version);
            if(attempt.SubmittedAt!=null) throw new ApiException(409,"attempt_submitted","تم تسليم هذه المحاولة. ابدأ محاولة جديدة للتدريب.");
            var job=await Quiz(db,attempt.JobId); var questions=Content(job).Questions;
            if(r.Answers==null || r.Answers.Any(a=>a.Key<0 || a.Key>=questions.Length || (a.Value!=null && (a.Value<0 || a.Value>=questions[a.Key].Choices.Length))))
                throw ApiException.Invalid("إحدى الإجابات غير صالحة.");
            attempt.AnswersJson=JsonSerializer.Serialize(r.Answers,JsonOptions);
            await db.SaveChangesAsync(); return View(attempt,job);
        });
        group.MapPost("/attempts/{id:guid}/submit", async (Guid id, SubmitRequest r, AppDb db, TimeProvider clock) =>
        {
            if(r.RequestKey==Guid.Empty) throw ApiException.Invalid("معرف التسليم مطلوب.");
            var attempt=await db.Attempts.SingleOrDefaultAsync(a=>a.Id==id) ?? throw ApiException.NotFound();
            var job=await Quiz(db,attempt.JobId);
            if(attempt.SubmittedAt!=null)
            {
                if(attempt.SubmitKey==r.RequestKey) return View(attempt,job);
                throw new ApiException(409,"attempt_submitted","تم تسليم هذه المحاولة بالفعل.");
            }
            Validate.Version(attempt,r.Version);
            var questions=Content(job).Questions;
            var answers=JsonSerializer.Deserialize<Dictionary<int,int?>>(attempt.AnswersJson,JsonOptions)!;
            if(!r.ConfirmUnanswered && Enumerable.Range(0,questions.Length).Any(i=>!answers.TryGetValue(i,out var answer)||answer==null))
                throw new ApiException(409,"unanswered_confirmation","توجد أسئلة دون إجابة. أكد التسليم لاحتسابها بإجابة خاطئة.");
            attempt.CorrectCount=questions.Select((q,i)=>answers.TryGetValue(i,out var answer)&&answer==q.CorrectIndex?1:0).Sum();
            attempt.SubmittedAt=clock.GetUtcNow().UtcDateTime; attempt.SubmitKey=r.RequestKey;
            await db.SaveChangesAsync(); return View(attempt,job);
        });
    }
    private static async Task<GenerationJob> Quiz(AppDb db,Guid id)
    {
        var job=await db.Jobs.SingleOrDefaultAsync(j=>j.Id==id) ?? throw ApiException.NotFound();
        if(job.Kind!="quiz"||job.Status!="completed") throw new ApiException(409,"quiz_not_ready","الاختبار غير جاهز.");
        return job;
    }
    private static GenerationDocument Content(GenerationJob job)=>JsonSerializer.Deserialize<GenerationDocument>(job.ResultJson,JsonOptions)!;
    private static object View(QuizAttempt attempt,GenerationJob job)
    {
        var content=Content(job); var answers=JsonSerializer.Deserialize<Dictionary<int,int?>>(attempt.AnswersJson,JsonOptions)!;
        object? review=attempt.SubmittedAt==null?null:content.Questions.Select((q,i)=>new { id=i,q.CorrectIndex,q.Explanation,q.Citations,
            isCorrect=answers.TryGetValue(i,out var answer)&&answer==q.CorrectIndex });
        return new { attempt.Id,attempt.JobId,attempt.Version,attempt.CreatedAt,attempt.SubmittedAt,attempt.CorrectCount,attempt.Total,answers,
            questions=content.Questions.Select((q,i)=>new { id=i,q.Kind,q.Prompt,q.Choices }),review };
    }
}
