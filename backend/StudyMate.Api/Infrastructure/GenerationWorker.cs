using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Security;

namespace StudyMate.Api.Infrastructure;

public sealed class GenerationProcessor(IServiceScopeFactory scopes, TimeProvider clock)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public async Task<bool> ProcessNext(CancellationToken ct)
    {
        using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var now = clock.GetUtcNow().UtcDateTime;
        var candidate = await db.Jobs.IgnoreQueryFilters().AsNoTracking()
            .Where(j => j.Status == "queued" || (j.Status == "running" && j.Deadline <= now))
            .OrderBy(j => j.CreatedAt).Select(j => new { j.Id, j.OwnerId }).FirstOrDefaultAsync(ct);
        if (candidate == null) return false;
        var actor = scope.ServiceProvider.GetRequiredService<CurrentUser>(); actor.Id = candidate.OwnerId; actor.Role = "student";
        var lease = Guid.NewGuid();
        var claimed = await db.Jobs.Where(j => j.Id == candidate.Id && (j.Status == "queued" || (j.Status == "running" && j.Deadline <= now)))
            .ExecuteUpdateAsync(p => p.SetProperty(j => j.Status, "running").SetProperty(j => j.LeaseId, lease).SetProperty(j => j.Version, j => j.Version + 1), ct);
        if (claimed == 0) return true;
        var job = await db.Jobs.AsNoTracking().SingleOrDefaultAsync(j => j.Id == candidate.Id, ct);
        if (job == null) return true;
        GenerationDocument? result = null; string? error = null;
        try
        {
            var remaining = job.Deadline - clock.GetUtcNow().UtcDateTime;
            if (remaining <= TimeSpan.Zero) throw new GenerationFailure("generation_timeout");
            if (!await db.Users.AnyAsync(u => u.Id == job.OwnerId && u.Active && u.DeletedAt == null, ct)) throw new GenerationFailure("account_unavailable");
            var pagesJson = await db.Sources.Where(s => s.Id == job.SourceId && s.Status == "ready").Select(s => s.PagesJson).SingleOrDefaultAsync(ct);
            if (pagesJson == null) throw new GenerationFailure("source_unavailable");
            var input = new GenerationInput(job.Kind, job.Language, job.QuestionCount, JsonSerializer.Deserialize<SourcePage[]>(pagesJson, JsonOptions)!);
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(remaining);
            result = await scope.ServiceProvider.GetRequiredService<IStudyGenerator>().Generate(input, deadline.Token);
            GenerationValidation.Validate(result, input);
            if (clock.GetUtcNow().UtcDateTime > job.Deadline) throw new GenerationFailure("generation_timeout");
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; } // Leave the reservation durable; recovery expires it.
        catch (OperationCanceledException) { error = "generation_timeout"; }
        catch (GenerationFailure ex) { error = ex.Code; }
        catch (Exception ex) when (ex is not OutOfMemoryException) { error = "generation_failed"; }
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var done = clock.GetUtcNow().UtcDateTime; var status = error == null ? "completed" : "failed";
        var changed = await db.Jobs.Where(j => j.Id == job.Id && j.Status == "running" && j.LeaseId == lease)
            .ExecuteUpdateAsync(p => p.SetProperty(j => j.Status, status).SetProperty(j => j.ErrorCode, error).SetProperty(j => j.CompletedAt, done)
                .SetProperty(j => j.ResultJson, error == null ? JsonSerializer.Serialize(result, JsonOptions) : "")
                .SetProperty(j => j.LeaseId, (Guid?)null).SetProperty(j => j.Version, j => j.Version + 1), ct);
        if (changed > 0)
        {
            await db.Usage.Where(u => u.Day == job.QuotaDay).ExecuteUpdateAsync(p => p.SetProperty(u => u.Reserved, u => u.Reserved - 1)
                .SetProperty(u => u.Used, u => u.Used + (error == null ? 1 : 0)).SetProperty(u => u.Version, u => u.Version + 1), ct);
        }
        await tx.CommitAsync(ct); return true;
    }
}

public sealed class GenerationWorker(GenerationProcessor processor, ILogger<GenerationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Ten independent consumers; each SQL claim is atomic and safe across server instances.
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Run(stoppingToken)));
    }
    private async Task Run(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { if (await processor.ProcessNext(ct)) continue; }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError("Generation worker failed with {Type}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(1), ct);
        }
    }
}

public static class GenerationDeletion
{
    // Call within the same transaction as the parent deletion. Usage survives content deletion to prevent quota bypass.
    public static async Task RemoveForChapters(AppDb db, Guid[] chapters)
    {
        var jobs = await db.Jobs.Where(j => chapters.Contains(j.ChapterId)).ToListAsync();
        var jobIds = jobs.Select(j=>j.Id).ToArray();
        db.Attempts.RemoveRange(await db.Attempts.Where(a=>jobIds.Contains(a.JobId)).ToListAsync());
        foreach (var day in jobs.Where(j => j.Status is "queued" or "running").GroupBy(j => j.QuotaDay))
        {
            var count = day.Count();
            await db.Usage.Where(u => u.Day == day.Key).ExecuteUpdateAsync(p => p.SetProperty(u => u.Reserved, u => u.Reserved - count).SetProperty(u => u.Version, u => u.Version + 1));
        }
        db.Jobs.RemoveRange(jobs);
        // Concurrency tokens make a racing completed job roll the deletion transaction back, including the reservation refund.
        await db.SaveChangesAsync();
    }
}
