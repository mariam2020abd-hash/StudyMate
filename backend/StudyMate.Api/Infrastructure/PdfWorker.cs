using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Security;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;
using UglyToad.PdfPig.Exceptions;

namespace StudyMate.Api.Infrastructure;

public sealed record SourcePage(int Number, string Text);
public sealed record PdfExtraction(SourcePage[] Pages, string? ErrorCode = null);

public static class PdfText
{
    public static PdfExtraction Extract(byte[] bytes, int maximumPages)
    {
        try
        {
            using var document = PdfDocument.Open(bytes);
            if (document.IsEncrypted) return new([], "pdf_protected");
            if (document.NumberOfPages > maximumPages) return new([], "pdf_page_limit");
            if (document.NumberOfPages == 0) return new([], "pdf_no_text");
            var pages = new List<SourcePage>();
            foreach (var page in document.GetPages())
            {
                var text = ContentOrderTextExtractor.GetText(page).Trim();
                // A page with pictures but no usable text needs OCR, which is outside the pilot.
                if (string.IsNullOrWhiteSpace(text) && page.NumberOfImages > 0) return new([], "pdf_ocr_required");
                pages.Add(new(page.Number, text));
            }
            if (!pages.Any(p => p.Text.Any(char.IsLetter))) return new([], "pdf_no_text");
            return new(pages.ToArray());
        }
        catch (PdfDocumentEncryptedException) { return new([], "pdf_protected"); }
        catch (Exception ex) when (ex is not OutOfMemoryException) { return new([], "pdf_corrupt"); }
    }
}

// Durable SQL lease makes pending uploads survive restarts and prevents multiple instances publishing twice.
public sealed class PdfProcessor(IServiceScopeFactory scopes, TimeProvider clock)
{
    public async Task<bool> ProcessNext(CancellationToken ct)
    {
        using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var now = clock.GetUtcNow().UtcDateTime;
        var candidate = await db.Sources.IgnoreQueryFilters().AsNoTracking()
            .Where(s => s.Status == "queued" || (s.Status == "processing" && s.LeaseUntil < now))
            .OrderBy(s => s.CreatedAt).Select(s => new { s.Id, s.OwnerId }).FirstOrDefaultAsync(ct);
        if (candidate == null) return false;
        var actor = scope.ServiceProvider.GetRequiredService<CurrentUser>(); actor.Id = candidate.OwnerId; actor.Role = "student";
        var lease = Guid.NewGuid();
        var claimed = await db.Sources.Where(s => s.Id == candidate.Id && (s.Status == "queued" || (s.Status == "processing" && s.LeaseUntil < now)))
            .ExecuteUpdateAsync(p => p.SetProperty(s => s.Status, "processing").SetProperty(s => s.LeaseId, lease)
                .SetProperty(s => s.LeaseUntil, now.AddMinutes(5)).SetProperty(s => s.Version, s => s.Version + 1), ct);
        if (claimed == 0) return true;
        var source = await db.Sources.AsNoTracking().SingleOrDefaultAsync(s => s.Id == candidate.Id, ct);
        if (source == null) return true;
        var result = await Task.Run(() => PdfText.Extract(source.Content, source.PageLimit), ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // A deletion or reclaimed lease must win over a late parser result.
        var status = result.ErrorCode == null ? "ready" : "failed";
        var updated = await db.Sources.Where(s => s.Id == source.Id && s.LeaseId == lease)
            .ExecuteUpdateAsync(p => p.SetProperty(s => s.Status, status).SetProperty(s => s.ErrorCode, result.ErrorCode)
                .SetProperty(s => s.PageCount, result.Pages.Length).SetProperty(s => s.PagesJson, JsonSerializer.Serialize(result.Pages, new JsonSerializerOptions(JsonSerializerDefaults.Web)))
                .SetProperty(s => s.LeaseId, (Guid?)null).SetProperty(s => s.LeaseUntil, (DateTime?)null).SetProperty(s => s.Version, s => s.Version + 1), ct);
        if (updated > 0) await db.Chapters.Where(c => c.Id == source.ChapterId).ExecuteUpdateAsync(p => p.SetProperty(c => c.Status, status)
            .SetProperty(c => c.ErrorCode, result.ErrorCode).SetProperty(c => c.Version, c => c.Version + 1), ct);
        await tx.CommitAsync(ct); return true;
    }
}

public sealed class PdfWorker(PdfProcessor processor, ILogger<PdfWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { if (await processor.ProcessNext(stoppingToken)) continue; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError("PDF worker failed with {Type}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }
}
