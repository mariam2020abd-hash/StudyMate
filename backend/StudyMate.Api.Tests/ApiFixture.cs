using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;

namespace StudyMate.Api.Tests;

public sealed class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public TestStudyGenerator Generator { get; } = new();
    public const string Password = "StudyMate.Test.Password.2026";
    private readonly string database = "StudyMateTests_" + Guid.NewGuid().ToString("N");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services => services.AddSingleton<IStudyGenerator>(Generator));
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:StudyMate"] = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("STUDYMATE_TEST_SQL") ?? "Server=(localdb)\\MSSQLLocalDB;Integrated Security=true;TrustServerCertificate=true") { InitialCatalog = database }.ConnectionString,
            ["Database:Initialize"] = "false", ["Mail:WorkerEnabled"] = "false", ["Pdf:WorkerEnabled"] = "false", ["Generation:WorkerEnabled"] = "false", ["Security:AuthRequestsPerMinute"] = "1000"
        }));
    }
    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        await db.Database.MigrateAsync(); await DatabaseSetup.SeedAsync(db);
    }
    public new async Task DisposeAsync()
    {
        using (var scope = Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            var catalog = new SqlConnectionStringBuilder(db.Database.GetConnectionString()).InitialCatalog;
            if (catalog != database || !Regex.IsMatch(catalog, "^StudyMateTests_[a-f0-9]{32}$")) throw new InvalidOperationException("Refusing to drop a non-test database.");
            await db.Database.EnsureDeletedAsync();
        }
        await base.DisposeAsync();
    }
    public async Task<(HttpClient Client, Guid Id, string Email, string Token)> Student()
    {
        var client = CreateClient(); var email = Guid.NewGuid().ToString("N") + "@example.test";
        (await client.PostAsJsonAsync("/api/auth/register", new { email, password = Password })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/verify", new { token = await LatestToken(email) })).EnsureSuccessStatusCode();
        var result = await Json(await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password }));
        var token = result.GetProperty("token").GetString()!; client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return (client, result.GetProperty("user").GetProperty("id").GetGuid(), email, token);
    }
    public async Task<HttpClient> Administrator()
    {
        var email = Guid.NewGuid().ToString("N") + "@admin.example.test";
        using (var scope = Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>(); var hash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
            var user = new User { Email = email, Verified = true, Role = "admin" }; user.PasswordHash = hash.HashPassword(user, Password);
            db.Users.Add(user); await db.SaveChangesAsync();
        }
        var client = CreateClient(); var json = await Json(await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password }));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", json.GetProperty("token").GetString()); return client;
    }
    public async Task<string> LatestToken(string email)
    {
        using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var mail = await db.MailMessages.Where(m => m.Recipient == email).OrderByDescending(m => m.CreatedAt).FirstAsync();
        var body = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector("StudyMate.Mail.v1").Unprotect(mail.ProtectedBody);
        return Regex.Match(body, "token=([A-F0-9]+)").Groups[1].Value;
    }
    public static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {body}");
        return JsonDocument.Parse(body).RootElement.Clone();
    }
}
