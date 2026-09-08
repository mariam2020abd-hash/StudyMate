using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

namespace StudyMate.Api.Features;

public static class PdfEndpoints
{
    public static void MapPdf(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.StudentGroup();
        group.MapGet("/upload-limits", async (AppDb db, IStudyGenerator generator) =>
        {
            var settings = await db.Settings.Select(s => new { s.MaxPdfBytes, s.MaxPdfPages }).SingleAsync();
            return new { settings.MaxPdfBytes, settings.MaxPdfPages, generationAvailable = generator.Configured };
        });
        group.MapPost("/chapters/{id:guid}/source", async (Guid id, long version, HttpRequest request, AppDb db, CurrentUser actor, CancellationToken ct) =>
        {
            var chapter = await db.Chapters.SingleOrDefaultAsync(c => c.Id == id, ct) ?? throw ApiException.NotFound();
            Validate.Version(chapter, version);
            if (await db.Sources.AnyAsync(s => s.ChapterId == id, ct))
                throw new ApiException(409, "source_immutable", "للشابتر ملف بالفعل. أنشئ شابترًا جديدًا لملف مختلف.");
            var settings = await db.Settings.SingleAsync(ct);
            if (request.ContentType?.Split(';')[0].Trim() != "application/pdf")
                throw new ApiException(415, "pdf_required", "اختر ملف PDF نصيًا.");
            if (request.ContentLength > settings.MaxPdfBytes) throw TooLarge();
            using var stream = new MemoryStream();
            var buffer = new byte[65536];
            while (true)
            {
                var read = await request.Body.ReadAsync(buffer, ct);
                if (read == 0) break;
                if (stream.Length + read > settings.MaxPdfBytes) throw TooLarge();
                await stream.WriteAsync(buffer.AsMemory(0, read), ct);
            }
            var bytes = stream.ToArray();
            if (bytes.Length < 8 || !bytes.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
                throw new ApiException(422, "pdf_corrupt", "الملف ليس PDF صالحًا.");
            var source = new ChapterSource { OwnerId = actor.RequireStudent(), ChapterId = id, Content = bytes,
                ByteCount = bytes.Length, Sha256 = Convert.ToHexString(SHA256.HashData(bytes)), PageLimit = settings.MaxPdfPages };
            chapter.Status = "queued"; chapter.ErrorCode = null;
            db.Sources.Add(source); await db.SaveChangesAsync(ct);
            return Results.Accepted($"/api/study/chapters/{id}/source", new { source.Id, source.Status, chapterVersion = chapter.Version });
        });
        group.MapGet("/chapters/{id:guid}/source", async (Guid id, AppDb db) =>
        {
            var chapterVersion = await db.Chapters.Where(c=>c.Id==id).Select(c=>c.Version).SingleOrDefaultAsync();
            if (chapterVersion == 0) throw ApiException.NotFound();
            var source = await db.Sources.Where(s => s.ChapterId == id)
                .Select(s => new { s.Id, s.Status, s.ErrorCode, s.ByteCount, s.PageCount, s.Sha256, s.Version, s.CreatedAt, chapterVersion }).SingleOrDefaultAsync();
            return Results.Content(JsonSerializer.Serialize(source, new JsonSerializerOptions(JsonSerializerDefaults.Web)), "application/json; charset=utf-8");
        });
        group.MapGet("/chapters/{id:guid}/source/pages", async (Guid id, AppDb db) =>
        {
            var source = await db.Sources.Where(s => s.ChapterId == id).Select(s => new { s.Status, s.PagesJson }).SingleOrDefaultAsync() ?? throw ApiException.NotFound();
            if (source.Status != "ready") throw new ApiException(409, "source_not_ready", "نص الشابتر غير جاهز.");
            return Results.Content(source.PagesJson, "application/json; charset=utf-8");
        });
        group.MapGet("/chapters/{id:guid}/source/download", async (Guid id, HttpResponse response, AppDb db) =>
        {
            var content = await db.Sources.Where(s => s.ChapterId == id).Select(s => s.Content).SingleOrDefaultAsync() ?? throw ApiException.NotFound();
            response.Headers.CacheControl = "no-store"; response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(content, "application/pdf", "chapter.pdf");
        });
        group.MapPost("/chapters/{id:guid}/source/retry", async (Guid id, AppDb db) =>
        {
            var source = await db.Sources.SingleOrDefaultAsync(s => s.ChapterId == id) ?? throw ApiException.NotFound();
            if (source.Status != "failed" || source.ErrorCode is not ("extraction_failed" or "extraction_timeout"))
                throw new ApiException(409, "retry_unavailable", "لا يمكن إعادة معالجة هذا الملف. تحقق من سبب الرفض.");
            var chapter = await db.Chapters.SingleAsync(c => c.Id == id);
            source.Status = chapter.Status = "queued"; source.ErrorCode = chapter.ErrorCode = null;
            await db.SaveChangesAsync(); return Results.Accepted();
        });
    }
    private static ApiException TooLarge() => new(413, "pdf_too_large", "حجم الملف يتجاوز الحد المسموح.");
}
