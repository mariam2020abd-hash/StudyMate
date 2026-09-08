using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudyMate.Api.Infrastructure;
using static StudyMate.Api.Tests.ApiFixture;

namespace StudyMate.Api.Tests;

public sealed class PdfTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private static byte[] FileBytes(string name) => File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Fixtures", name));
    private static async Task<(Guid Course, Guid Chapter)> Chapter(HttpClient client)
    {
        var course = await Json(await client.PostAsJsonAsync("/api/study/courses", new { name = Guid.NewGuid().ToString() }));
        var courseId = course.GetProperty("id").GetGuid();
        var chapter = await Json(await client.PostAsJsonAsync($"/api/study/courses/{courseId}/chapters", new { title = "PDF chapter" }));
        return (courseId, chapter.GetProperty("id").GetGuid());
    }
    private static Task<HttpResponseMessage> Upload(HttpClient client, Guid chapter, byte[] bytes, long version = 1)
    {
        var content = new ByteArrayContent(bytes); content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        return client.PostAsync($"/api/study/chapters/{chapter}/source?version={version}", content);
    }
    private async Task Drain()
    {
        var processor = fixture.Services.GetRequiredService<PdfProcessor>();
        for (var i = 0; i < 30; i++) if (!await processor.ProcessNext(CancellationToken.None)) return;
        Assert.Fail("PDF queue did not drain.");
    }

    [Fact]
    public async Task Bilingual_text_is_persisted_by_page_and_private_across_all_routes()
    {
        var student = await fixture.Student(); var other = await fixture.Student(); var admin = await fixture.Administrator();
        var (_, chapter) = await Chapter(student.Client); var path = $"/api/study/chapters/{chapter}/source";
        Assert.Equal(JsonValueKind.Null, (await Json(await student.Client.GetAsync(path))).ValueKind);
        (await Upload(student.Client, chapter, FileBytes("bilingual.pdf"))).EnsureSuccessStatusCode();
        Assert.Equal("queued", (await Json(await student.Client.GetAsync(path))).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await student.Client.GetAsync(path + "/pages")).StatusCode);
        await Drain();
        var ready = await Json(await student.Client.GetAsync(path)); Assert.Equal("ready", ready.GetProperty("status").GetString());
        Assert.Equal(2, ready.GetProperty("pageCount").GetInt32());
        var pages = await Json(await student.Client.GetAsync(path + "/pages"));
        Assert.Equal(1, pages[0].GetProperty("number").GetInt32());
        Assert.Contains("DNA", pages[0].GetProperty("text").GetString());
        Assert.Contains("الخلية", pages[0].GetProperty("text").GetString());
        Assert.Contains("nucleus", pages[1].GetProperty("text").GetString());
        foreach (var suffix in new[] { "", "/pages", "/download" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await other.Client.GetAsync(path + suffix)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync(path + suffix)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await Upload(other.Client, chapter, FileBytes("bilingual.pdf"))).StatusCode);
        var download = await student.Client.GetAsync(path + "/download");
        Assert.Equal(FileBytes("bilingual.pdf"), await download.Content.ReadAsByteArrayAsync());
        Assert.True(download.Headers.CacheControl?.NoStore);
        Assert.Equal(HttpStatusCode.Conflict, (await Upload(student.Client, chapter, FileBytes("bilingual.pdf"), 3)).StatusCode);
    }

    [Theory]
    [InlineData("protected.pdf", "pdf_protected")]
    [InlineData("scanned.pdf", "pdf_ocr_required")]
    [InlineData("101-pages.pdf", "pdf_page_limit")]
    public async Task Unsupported_pdfs_have_persistent_failure_without_exposed_text(string file, string error)
    {
        var student = await fixture.Student(); var (_, chapter) = await Chapter(student.Client);
        (await Upload(student.Client, chapter, FileBytes(file))).EnsureSuccessStatusCode(); await Drain();
        var path = $"/api/study/chapters/{chapter}/source";
        var status = await Json(await student.Client.GetAsync(path));
        Assert.Equal("failed", status.GetProperty("status").GetString()); Assert.Equal(error, status.GetProperty("errorCode").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await student.Client.GetAsync(path + "/pages")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await student.Client.PostAsJsonAsync(path + "/retry", new {})).StatusCode);
    }

    [Fact]
    public async Task Invalid_signature_oversize_stale_and_corrupt_uploads_are_handled()
    {
        var student = await fixture.Student(); var (_, chapter) = await Chapter(student.Client);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Upload(student.Client, chapter, Encoding.UTF8.GetBytes("this is not a PDF"))).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await Upload(student.Client, chapter, new byte[20_000_001])).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Upload(student.Client, chapter, FileBytes("bilingual.pdf"), 99)).StatusCode);
        (await Upload(student.Client, chapter, Encoding.UTF8.GetBytes("%PDF-1.7\ninvalid document"))).EnsureSuccessStatusCode();
        await Drain();
        var status = await Json(await student.Client.GetAsync($"/api/study/chapters/{chapter}/source"));
        Assert.Equal("pdf_corrupt", status.GetProperty("errorCode").GetString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Deletion_removes_original_and_pending_processing_cannot_resurrect_it(bool deleteCourse)
    {
        var student = await fixture.Student(); var (course, chapter) = await Chapter(student.Client);
        (await Upload(student.Client, chapter, FileBytes("bilingual.pdf"))).EnsureSuccessStatusCode();
        var target = deleteCourse ? $"courses/{course}?version=1" : $"chapters/{chapter}?version=2";
        (await student.Client.DeleteAsync($"/api/study/{target}&confirm=true")).EnsureSuccessStatusCode(); await Drain();
        Assert.Equal(HttpStatusCode.NotFound, (await student.Client.GetAsync($"/api/study/chapters/{chapter}/source/download")).StatusCode);
        using var scope = fixture.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        Assert.False(await db.Sources.IgnoreQueryFilters().AnyAsync(s => s.ChapterId == chapter));
    }

    [Fact]
    public async Task Expired_processing_lease_is_recovered_after_restart()
    {
        var student = await fixture.Student(); var (_, chapter) = await Chapter(student.Client);
        (await Upload(student.Client, chapter, FileBytes("bilingual.pdf"))).EnsureSuccessStatusCode();
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.Sources.IgnoreQueryFilters().Where(s => s.ChapterId == chapter).ExecuteUpdateAsync(p => p.SetProperty(s => s.Status, "processing")
                .SetProperty(s => s.LeaseUntil, DateTime.UtcNow.AddMinutes(-1)).SetProperty(s => s.LeaseId, Guid.NewGuid()));
        }
        await Drain(); Assert.Equal("ready", (await Json(await student.Client.GetAsync($"/api/study/chapters/{chapter}/source"))).GetProperty("status").GetString());
    }
}
