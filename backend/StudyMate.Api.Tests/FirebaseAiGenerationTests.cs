using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using StudyMate.Api.Infrastructure;

namespace StudyMate.Api.Tests;

public sealed class FirebaseAiGenerationTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly GenerationInput Input = new("summary", "en", 10, [new(1, "Cells contain DNA.")]);
    private sealed class Credential : IFirebaseServerCredential
    { public Task<string> GetToken(CancellationToken ct) => Task.FromResult("synthetic-server-token"); }
    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> callback) : HttpMessageHandler
    { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => callback(request); }
    private static FirebaseAiStudyGenerator Generator(Handler handler, bool verified = true) => new(new HttpClient(handler),
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Firebase:ProjectId"] = "test-project", ["FirebaseAI:TemplateId"] = "studymate-content-v1",
            ["FirebaseAI:Enabled"] = "true", ["FirebaseAI:ServerRouteVerified"] = verified.ToString()
        }).Build(), new Credential());
    private static HttpResponseMessage Response(string finish = "STOP", string quote = "Cells contain DNA.")
    {
        var document = new GenerationDocument(false, "en", [new("Cells", "Cells contain DNA.", [new(1, quote)])], []);
        return new(HttpStatusCode.OK) { Content = JsonContent.Create(new {
            modelVersion = "gemini-test", candidates = new[] { new { finishReason = finish,
                content = new { parts = new[] { new { text = JsonSerializer.Serialize(document, Json) } } } } }
        }) };
    }
    [Fact]
    public async Task Uses_Firebase_template_with_server_token_and_records_actual_provider()
    {
        using var handler = new Handler(async request => {
            Assert.Equal("https://firebasevertexai.googleapis.com/v1beta/projects/test-project/templates/studymate-content-v1:templateGenerateContent", request.RequestUri!.ToString());
            Assert.Equal("synthetic-server-token", request.Headers.Authorization!.Parameter);
            Assert.Equal("test-project", Assert.Single(request.Headers.GetValues("x-goog-user-project")));
            var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
            Assert.Equal("summary", body.RootElement.GetProperty("inputs").GetProperty("kind").GetString());
            return Response();
        });
        var result = await Generator(handler).Generate(Input, default);
        Assert.Equal("Firebase AI Logic", result.Provider);
        Assert.Equal("gemini-test", result.Model);
        Assert.Equal("studymate-content-v1", result.Template);
    }
    [Fact]
    public async Task Unproven_route_cannot_send_requests()
    {
        using var handler = new Handler(_ => throw new Exception("Must not send"));
        var generator = Generator(handler, false);
        Assert.False(generator.Configured);
        Assert.Equal("generation_unavailable", (await Assert.ThrowsAsync<GenerationFailure>(() => generator.Generate(Input, default))).Code);
    }
    [Theory]
    [InlineData("MAX_TOKENS", "Cells contain DNA.", "generation_incomplete")]
    [InlineData("STOP", "invented evidence", "invalid_citations")]
    public async Task Rejects_incomplete_or_unsupported_output(string finish, string quote, string expected)
    {
        using var handler = new Handler(_ => Task.FromResult(Response(finish, quote)));
        Assert.Equal(expected, (await Assert.ThrowsAsync<GenerationFailure>(() => Generator(handler).Generate(Input, default))).Code);
    }
    [Theory]
    [InlineData(403, "provider_auth_unavailable")]
    [InlineData(429, "provider_busy")]
    [InlineData(500, "provider_failed")]
    public async Task Sanitizes_provider_failures(int status, string expected)
    {
        using var handler = new Handler(_ => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status) { Content = new StringContent("private provider response") }));
        Assert.Equal(expected, (await Assert.ThrowsAsync<GenerationFailure>(() => Generator(handler).Generate(Input, default))).Code);
    }
}
