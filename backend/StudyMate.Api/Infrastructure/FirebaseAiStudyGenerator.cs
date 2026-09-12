using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Google.Apis.Auth.OAuth2;

namespace StudyMate.Api.Infrastructure;

public interface IFirebaseServerCredential
{
    Task<string> GetToken(CancellationToken ct);
}

public sealed class FirebaseServerCredential : IFirebaseServerCredential
{
    public async Task<string> GetToken(CancellationToken ct)
    {
        // ADC stays outside the website and repository; never use a student's ID/debug token here.
        var credential = await GoogleCredential.GetApplicationDefaultAsync(ct);
        return await credential.CreateScoped("https://www.googleapis.com/auth/cloud-platform")
            .UnderlyingCredential.GetAccessTokenForRequestAsync(cancellationToken: ct);
    }
}

// Candidate server route: keep gated until an authenticated live probe and client-denial test pass.
public sealed class FirebaseAiStudyGenerator(HttpClient http, IConfiguration config, IFirebaseServerCredential credential) : IStudyGenerator
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private string Project => config["Firebase:ProjectId"] ?? "";
    private string Template => config["FirebaseAI:TemplateId"] ?? "";
    private static bool SafeId(string id) => Regex.IsMatch(id, "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$");
    public bool Configured => config.GetValue("FirebaseAI:Enabled", false)
        && config.GetValue("FirebaseAI:ServerRouteVerified", false) && SafeId(Project) && SafeId(Template);

    public async Task<GenerationDocument> Generate(GenerationInput input, CancellationToken ct)
    {
        if (!Configured) throw new GenerationFailure("generation_unavailable");
        if (input.Kind is not ("explanation" or "summary" or "quiz") || input.Language is not ("ar" or "en")
            || input.QuestionCount is < 1 or > 50 || input.Pages.Length == 0)
            throw new GenerationFailure("invalid_generation_request");
        string token;
        try { token = await credential.GetToken(ct); }
        catch (OperationCanceledException) { throw; }
        catch { throw new GenerationFailure("provider_auth_unavailable"); }
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://firebasevertexai.googleapis.com/v1beta/projects/{Project}/templates/{Template}:templateGenerateContent");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("x-goog-user-project", Project);
        request.Content = JsonContent.Create(new { inputs = new {
            kind = input.Kind, language = input.Language, questionCount = input.QuestionCount,
            sourcePages = JsonSerializer.Serialize(input.Pages, JsonOptions)
        } });
        try
        {
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode) throw new GenerationFailure((int)response.StatusCode switch {
                429 => "provider_busy", 401 or 403 => "provider_auth_unavailable", _ => "provider_failed"
            });
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var bytes = new MemoryStream(); var buffer = new byte[16384];
            while (true)
            {
                var count = await stream.ReadAsync(buffer, ct); if (count == 0) break;
                if (bytes.Length + count > 2_000_000) throw new GenerationFailure("invalid_generation");
                await bytes.WriteAsync(buffer.AsMemory(0, count), ct);
            }
            using var json = JsonDocument.Parse(bytes.ToArray());
            var root = json.RootElement;
            if (root.TryGetProperty("promptFeedback", out var feedback) && feedback.TryGetProperty("blockReason", out _))
                throw new GenerationFailure("generation_refused");
            var candidates = root.GetProperty("candidates");
            if (candidates.GetArrayLength() != 1) throw new GenerationFailure("invalid_generation");
            var candidate = candidates[0];
            if (candidate.GetProperty("finishReason").GetString() != "STOP") throw new GenerationFailure("generation_incomplete");
            var output = new StringBuilder();
            foreach (var part in candidate.GetProperty("content").GetProperty("parts").EnumerateArray())
            {
                if (part.TryGetProperty("thought", out var thought) && thought.GetBoolean()) continue;
                if (!part.TryGetProperty("text", out var text)) throw new GenerationFailure("invalid_generation");
                output.Append(text.GetString());
            }
            var validated = GenerationValidation.Validate(JsonSerializer.Deserialize<GenerationDocument>(output.ToString(), JsonOptions), input);
            return validated with { Provider = "Firebase AI Logic", Template = Template,
                Model = root.TryGetProperty("modelVersion", out var model) ? model.GetString() : null };
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new GenerationFailure("generation_timeout"); }
        catch (HttpRequestException) { throw new GenerationFailure("provider_failed"); }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or KeyNotFoundException)
        { throw new GenerationFailure("invalid_generation"); }
    }
}
