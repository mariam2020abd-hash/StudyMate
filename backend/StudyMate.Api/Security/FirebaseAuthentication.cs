using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace StudyMate.Api.Security;

public static class FirebaseAuthentication
{
    public static void AddFirebaseAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var project = configuration["Firebase:ProjectId"] ?? throw new InvalidOperationException("Configure Firebase:ProjectId.");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            // Google's OIDC metadata supplies rotating public signing keys. No private key is needed.
            options.Authority = $"https://securetoken.google.com/{project}";
            options.Audience = project;
            options.MapInboundClaims = false;
            options.IncludeErrorDetails = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = options.Authority,
                ValidateAudience = true, ValidAudience = project,
                ValidateIssuerSigningKey = true, RequireSignedTokens = true,
                ValidateLifetime = true, RequireExpirationTime = true,
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256], ClockSkew = TimeSpan.Zero
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    // Existing mobile clients still use opaque legacy sessions.
                    var header = context.Request.Headers.Authorization.ToString();
                    if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) || !header.Contains('.')) context.NoResult();
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    var principal = context.Principal!;
                    var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    var uid = principal.FindFirst("sub")?.Value;
                    if (string.IsNullOrWhiteSpace(uid) || uid.Length > 128 ||
                        principal.FindFirst("email_verified")?.Value != "true" ||
                        !long.TryParse(principal.FindFirst("iat")?.Value, out var issued) || issued > now ||
                        !long.TryParse(principal.FindFirst("auth_time")?.Value, out var authenticated) || authenticated > now)
                        context.Fail("Invalid or unverified Firebase identity.");
                    return Task.CompletedTask;
                }
            };
        });
    }
}
