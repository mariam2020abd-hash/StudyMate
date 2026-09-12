using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using StudyMate.Api.Infrastructure;
using static StudyMate.Api.Tests.ApiFixture;

namespace StudyMate.Api.Tests;

public sealed class FirebaseAuthTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    private static readonly RsaSecurityKey Key = new(RSA.Create(2048)) { KeyId = "test-only" };
    private const string Issuer = "https://securetoken.google.com/studymate-dev-a2766";
    private HttpClient Client(string token)
    {
        var factory = fixture.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                var metadata = new OpenIdConnectConfiguration { Issuer = Issuer };
                metadata.SigningKeys.Add(Key);
                options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(metadata);
            })));
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
    private static string Token(string uid, string email, string variant = "valid")
    {
        var now = DateTimeOffset.UtcNow;
        var key = variant == "signature" ? new RsaSecurityKey(RSA.Create(2048)) { KeyId = Key.KeyId } : Key;
        var claims = new[] {
            new Claim("sub", uid), new Claim("email", email),
            new Claim("email_verified", variant == "unverified" ? "false" : "true", ClaimValueTypes.Boolean),
            new Claim("iat", now.AddSeconds(variant == "future-issued" ? 3600 : -60).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim("auth_time", now.AddSeconds(variant == "future-auth" ? 3600 : -60).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim("role", "admin") // Must never grant administrator access.
        };
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            variant == "issuer" ? "https://attacker.invalid" : Issuer,
            variant == "audience" ? "another-project" : "studymate-dev-a2766", claims,
            now.AddHours(-2).UtcDateTime, now.AddMinutes(variant == "expired" ? -1 : 30).UtcDateTime,
            new SigningCredentials(key, SecurityAlgorithms.RsaSha256)));
    }

    [Theory]
    [InlineData("signature")]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("expired")]
    [InlineData("unverified")]
    [InlineData("future-issued")]
    [InlineData("future-auth")]
    public async Task Rejects_invalid_identity(string variant)
    {
        var client = Client(Token(Guid.NewGuid().ToString(), "firebase@example.test", variant));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/firebase", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me")).StatusCode);
    }

    [Fact]
    public async Task Verified_identity_provisions_once_and_ignores_claimed_role()
    {
        var uid = Guid.NewGuid().ToString(); var email = uid + "@example.test";
        var client = Client(Token(uid, email));
        var profile = await Json(await client.PostAsJsonAsync("/api/auth/firebase", new { role = "admin" }));
        Assert.Equal("student", profile.GetProperty("role").GetString());
        var again = await Json(await client.PostAsJsonAsync("/api/auth/firebase", new { }));
        Assert.Equal(profile.GetProperty("id").GetGuid(), again.GetProperty("id").GetGuid());
        (await client.GetAsync("/api/me")).EnsureSuccessStatusCode();
        using var scope = fixture.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var user = await db.Users.SingleAsync(u => u.FirebaseUid == uid);
        user.Active = false; await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/firebase", new { })).StatusCode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Linking_preserves_existing_student_id_and_rejects_second_uid(bool previouslyVerified)
    {
        var student = await fixture.Student();
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            var user = await db.Users.SingleAsync(u => u.Id == student.Id);
            user.Verified = previouslyVerified;
            await db.SaveChangesAsync();
        }
        var client = Client(Token(Guid.NewGuid().ToString(), student.Email));
        var profile = await Json(await client.PostAsJsonAsync("/api/auth/firebase", new { }));
        Assert.Equal(student.Id, profile.GetProperty("id").GetGuid());
        Assert.True(profile.GetProperty("verified").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await student.Client.GetAsync("/api/me")).StatusCode);
        var other = Client(Token(Guid.NewGuid().ToString(), student.Email));
        Assert.Equal(HttpStatusCode.Conflict, (await other.PostAsJsonAsync("/api/auth/firebase", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await student.Client.PostAsJsonAsync("/api/auth/login", new { email = student.Email, password = Password })).StatusCode);
    }
}
