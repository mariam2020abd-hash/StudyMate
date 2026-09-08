using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudyMate.Api.Features;
using StudyMate.Api.Infrastructure;
using static StudyMate.Api.Tests.ApiFixture;

namespace StudyMate.Api.Tests;

public sealed class TestStudyGenerator : IStudyGenerator
{
    public bool Configured { get; set; } = true;
    public string? Failure { get; set; }
    public int Calls;
    public Task<GenerationDocument> Generate(GenerationInput input, CancellationToken ct)
    {
        Interlocked.Increment(ref Calls);
        if (Failure != null) throw new GenerationFailure(Failure);
        var cite = new Citation(1, "Cells contain DNA.");
        return Task.FromResult(input.Kind == "quiz"
            ? new GenerationDocument(false, input.Language, [], Enumerable.Range(0, input.QuestionCount).Select(i =>
                new StudyQuestion("multiple_choice", $"Question {i}", ["DNA", "Stone", "Rain", "Cloud"], 0, "Cells contain DNA.", [cite])).ToArray())
            : new GenerationDocument(false, input.Language, [new("Cells", "Cells contain DNA.", [cite])], []));
    }
}

public sealed class JobTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private async Task<(HttpClient Client, Guid Chapter)> ReadyChapter()
    {
        var s = await fixture.Student();
        var course = await Json(await s.Client.PostAsJsonAsync("/api/study/courses", new { name = "Biology" }));
        var chapter = await Json(await s.Client.PostAsJsonAsync($"/api/study/courses/{course.GetProperty("id").GetGuid()}/chapters", new { title = "Cells" }));
        var id = chapter.GetProperty("id").GetGuid();
        // Seed already-extracted text to isolate generation tests; real PDF extraction is covered in PdfTests.
        using var scope = fixture.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        db.Sources.Add(new Domain.ChapterSource { OwnerId = s.Id, ChapterId = id, Content = [], Status = "ready", PageCount = 1,
            PagesJson = JsonSerializer.Serialize(new[] { new SourcePage(1, "Cells contain DNA. A nucleus contains genetic information.") }, new JsonSerializerOptions(JsonSerializerDefaults.Web)) });
        await db.SaveChangesAsync(); return (s.Client,id);
    }
    private static Task<HttpResponseMessage> Create(HttpClient client, Guid chapter, Guid key, string kind = "summary") =>
        client.PostAsJsonAsync($"/api/study/chapters/{chapter}/generations", new { kind, language = "en", requestKey = key });
    private async Task Drain()
    {
        var processor = fixture.Services.GetRequiredService<GenerationProcessor>();
        for (var i = 0; i < 30; i++) if (!await processor.ProcessNext(CancellationToken.None)) return;
        Assert.Fail("Generation queue did not drain.");
    }

    [Fact]
    public async Task Concurrent_replays_reserve_once_and_reads_do_not_consume_quota()
    {
        var (client, chapter) = await ReadyChapter(); var key = Guid.NewGuid(); var calls = fixture.Generator.Calls;
        var responses = await Task.WhenAll(Enumerable.Range(0,4).Select(_ => Create(client,chapter,key)));
        var ids = new List<Guid>(); foreach (var r in responses) ids.Add((await Json(r)).GetProperty("id").GetGuid());
        Assert.Single(ids.Distinct());
        var quota = await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(1,quota.GetProperty("reserved").GetInt32());
        await Drain(); Assert.Equal(calls+1,fixture.Generator.Calls);
        var result = await Json(await client.GetAsync($"/api/study/generations/{ids[0]}")); Assert.Equal("completed",result.GetProperty("status").GetString());
        Assert.Equal("Cells",result.GetProperty("result").GetProperty("sections")[0].GetProperty("title").GetString());
        (await Create(client,chapter,key)).EnsureSuccessStatusCode();
        quota = await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(1,quota.GetProperty("used").GetInt32()); Assert.Equal(0,quota.GetProperty("reserved").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict,(await Create(client,chapter,key,"quiz")).StatusCode);
    }

    [Fact]
    public async Task Concurrent_requests_cannot_exceed_daily_quota()
    {
        var (client,chapter) = await ReadyChapter();
        var responses = await Task.WhenAll(Enumerable.Range(0,12).Select(_ => Create(client,chapter,Guid.NewGuid())));
        Assert.Equal(10,responses.Count(r => r.StatusCode == HttpStatusCode.Accepted));
        Assert.Equal(2,responses.Count(r => r.StatusCode == HttpStatusCode.TooManyRequests));
        var quota = await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(10,quota.GetProperty("reserved").GetInt32());
        await Drain(); quota = await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(10,quota.GetProperty("used").GetInt32()); Assert.Equal(0,quota.GetProperty("remaining").GetInt32());
    }

    [Fact]
    public async Task Failure_releases_reservation_and_retry_needs_a_new_request_key()
    {
        var (client,chapter) = await ReadyChapter(); var key = Guid.NewGuid();
        var job = await Json(await Create(client,chapter,key));
        fixture.Generator.Failure = "provider_busy";
        try { await Drain(); } finally { fixture.Generator.Failure = null; }
        var result = await Json(await Create(client,chapter,key)); Assert.Equal("failed",result.GetProperty("status").GetString());
        Assert.Equal(job.GetProperty("id").GetGuid(),result.GetProperty("id").GetGuid());
        var quota = await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(10,quota.GetProperty("remaining").GetInt32());
        (await Create(client,chapter,Guid.NewGuid())).EnsureSuccessStatusCode(); await Drain();
        quota = await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(1,quota.GetProperty("used").GetInt32());
    }

    [Fact]
    public async Task Quiz_keys_explanations_and_other_students_results_are_not_exposed()
    {
        var (client,chapter) = await ReadyChapter(); var other = await fixture.Student(); var admin = await fixture.Administrator();
        var created = await Json(await Create(client,chapter,Guid.NewGuid(),"quiz")); await Drain();
        var path = $"/api/study/generations/{created.GetProperty("id").GetGuid()}";
        var response = await client.GetAsync(path); var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("correctIndex",raw); Assert.DoesNotContain("explanation",raw); Assert.DoesNotContain("resultJson",raw); Assert.DoesNotContain("citations",raw);
        var json = await Json(response); Assert.Equal(10,json.GetProperty("result").GetProperty("questions").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound,(await other.Client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await admin.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task Expired_jobs_release_quota_without_provider_call()
    {
        var (client,chapter) = await ReadyChapter(); var created = await Json(await Create(client,chapter,Guid.NewGuid())); var id=created.GetProperty("id").GetGuid();
        using (var scope=fixture.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.Jobs.IgnoreQueryFilters().Where(j=>j.Id==id).ExecuteUpdateAsync(p=>p.SetProperty(j=>j.Status,"running").SetProperty(j=>j.Deadline,DateTime.UtcNow.AddSeconds(-1)));
        }
        var calls=fixture.Generator.Calls; await Drain(); Assert.Equal(calls,fixture.Generator.Calls);
        var job=await Json(await client.GetAsync($"/api/study/generations/{id}")); Assert.Equal("generation_timeout",job.GetProperty("errorCode").GetString());
        Assert.Equal(10,(await Json(await client.GetAsync("/api/study/quota"))).GetProperty("remaining").GetInt32());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Chapter_deletion_refunds_only_pending_reservations(bool complete)
    {
        var (client,chapter)=await ReadyChapter(); var created=await Json(await Create(client,chapter,Guid.NewGuid()));
        if(complete)
        {
            await Drain();
            var completedJob=await Json(await client.GetAsync($"/api/study/generations/{created.GetProperty("id").GetGuid()}"));
            Assert.True(completedJob.GetProperty("status").GetString()=="completed",completedJob.GetRawText());
            Assert.Equal(1,(await Json(await client.GetAsync("/api/study/quota"))).GetProperty("used").GetInt32());
        }
        (await client.DeleteAsync($"/api/study/chapters/{chapter}?version=1&confirm=true")).EnsureSuccessStatusCode(); await Drain();
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync($"/api/study/generations/{created.GetProperty("id").GetGuid()}")).StatusCode);
        var quota=await Json(await client.GetAsync("/api/study/quota")); Assert.Equal(0,quota.GetProperty("reserved").GetInt32()); Assert.Equal(complete?1:0,quota.GetProperty("used").GetInt32());
    }

    [Fact]
    public void Quota_day_changes_at_Riyadh_midnight()
    {
        Assert.Equal(new DateOnly(2026,9,6),GenerationEndpoints.RiyadhDay(new DateTime(2026,9,6,20,59,59,DateTimeKind.Utc)));
        Assert.Equal(new DateOnly(2026,9,7),GenerationEndpoints.RiyadhDay(new DateTime(2026,9,6,21,0,0,DateTimeKind.Utc)));
    }

    [Fact]
    public async Task Unconfigured_generation_is_visible_and_does_not_reserve_quota()
    {
        var (client,chapter)=await ReadyChapter();
        fixture.Generator.Configured=false;
        try
        {
            var limits=await Json(await client.GetAsync("/api/study/upload-limits"));
            Assert.False(limits.GetProperty("generationAvailable").GetBoolean());
            var quota=await Json(await client.GetAsync("/api/study/quota"));
            Assert.False(quota.GetProperty("generationAvailable").GetBoolean());
            Assert.Equal(HttpStatusCode.ServiceUnavailable,(await Create(client,chapter,Guid.NewGuid())).StatusCode);
            quota=await Json(await client.GetAsync("/api/study/quota"));
            Assert.Equal(0,quota.GetProperty("reserved").GetInt32());
            Assert.Equal(10,quota.GetProperty("remaining").GetInt32());
        }
        finally { fixture.Generator.Configured=true; }
    }

    [Fact]
    public async Task Answers_persist_grade_is_server_computed_and_submission_is_immutable()
    {
        var (client,chapter)=await ReadyChapter(); var other=await fixture.Student(); var admin=await fixture.Administrator();
        var job=await Json(await Create(client,chapter,Guid.NewGuid(),"quiz")); await Drain(); var jobId=job.GetProperty("id").GetGuid();
        var attemptKey=Guid.NewGuid(); var attemptPath=$"/api/study/generations/{jobId}/attempts";
        var attempt=await Json(await client.PostAsJsonAsync(attemptPath,new { requestKey=attemptKey })); var id=attempt.GetProperty("id").GetGuid(); var path=$"/api/study/attempts/{id}";
        Assert.Equal(JsonValueKind.Null,attempt.GetProperty("review").ValueKind);
        Assert.DoesNotContain("correctIndex",attempt.GetRawText());
        var replay=await Json(await client.PostAsJsonAsync(attemptPath,new { requestKey=attemptKey })); Assert.Equal(id,replay.GetProperty("id").GetGuid());
        var answers=new Dictionary<int,int?> { [0]=0,[1]=1 };
        var saved=await Json(await client.PutAsJsonAsync(path+"/answers",new { answers,version=1,correctCount=10 })); Assert.Equal(2,saved.GetProperty("version").GetInt64());
        Assert.Equal(1,(await Json(await client.GetAsync(path))).GetProperty("answers").GetProperty("1").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync(path+"/answers",new { answers,version=1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PutAsJsonAsync(path+"/answers",new { answers=new Dictionary<int,int> { [10]=0 },version=2 })).StatusCode);
        var submitKey=Guid.NewGuid();
        var unconfirmed=await client.PostAsJsonAsync(path+"/submit",new { requestKey=submitKey,version=2,confirmUnanswered=false });
        Assert.Equal(HttpStatusCode.Conflict,unconfirmed.StatusCode); Assert.Contains("unanswered_confirmation",await unconfirmed.Content.ReadAsStringAsync());
        var result=await Json(await client.PostAsJsonAsync(path+"/submit",new { requestKey=submitKey,version=2,confirmUnanswered=true,correctCount=10 }));
        Assert.Equal(1,result.GetProperty("correctCount").GetInt32()); Assert.Equal(10,result.GetProperty("total").GetInt32());
        Assert.True(result.GetProperty("review")[0].GetProperty("isCorrect").GetBoolean()); Assert.False(result.GetProperty("review")[1].GetProperty("isCorrect").GetBoolean());
        var repeated=await Json(await client.PostAsJsonAsync(path+"/submit",new { requestKey=submitKey,version=2,confirmUnanswered=true }));
        Assert.Equal(result.GetProperty("submittedAt").GetString(),repeated.GetProperty("submittedAt").GetString());
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync(path+"/answers",new { answers,version=3 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await other.Client.GetAsync(path)).StatusCode); Assert.Equal(HttpStatusCode.Forbidden,(await admin.GetAsync(path)).StatusCode);
        var retake=await Json(await client.PostAsJsonAsync(attemptPath,new { requestKey=Guid.NewGuid() })); Assert.NotEqual(id,retake.GetProperty("id").GetGuid());
        Assert.Empty(retake.GetProperty("answers").EnumerateObject()); Assert.Equal(JsonValueKind.Null,retake.GetProperty("correctCount").ValueKind);
        Assert.Equal(2,(await Json(await client.GetAsync(attemptPath))).GetArrayLength());
        Assert.Equal(1,(await Json(await client.GetAsync("/api/study/quota"))).GetProperty("used").GetInt32());
        Assert.Equal(0,(await Json(await client.GetAsync("/api/study/dashboard"))).GetProperty("completed").GetInt32());
        (await client.DeleteAsync($"/api/study/chapters/{chapter}?version=1&confirm=true")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync(path)).StatusCode);
    }
}
