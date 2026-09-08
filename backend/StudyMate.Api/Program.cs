using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Features;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddFirebaseAuthentication(builder.Configuration);
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210_000);
builder.Services.AddDbContext<AppDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("StudyMate") ?? throw new InvalidOperationException("Configure ConnectionStrings:StudyMate.")));
var keys = new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "keys"));
builder.Services.AddDataProtection().SetApplicationName("StudyMate").PersistKeysToFileSystem(keys);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? []).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
    { PermitLimit = builder.Configuration.GetValue("Security:AuthRequestsPerMinute", 30), Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = new { code = "rate_limited", message = "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.", traceId = context.HttpContext.TraceIdentifier } }, token);
    };
});
if (builder.Configuration.GetValue("Mail:WorkerEnabled", true)) builder.Services.AddHostedService<MailWorker>();
builder.Services.AddSingleton<PdfProcessor>();
builder.Services.AddHttpClient<IStudyGenerator, OpenAiStudyGenerator>(client => client.Timeout = TimeSpan.FromSeconds(180));
builder.Services.AddSingleton<GenerationProcessor>();
if (builder.Configuration.GetValue("Generation:WorkerEnabled", true)) builder.Services.AddHostedService<GenerationWorker>();
if (builder.Configuration.GetValue("Pdf:WorkerEnabled", true)) builder.Services.AddHostedService<PdfWorker>();
if (!Uri.TryCreate(builder.Configuration["PublicWebUrl"], UriKind.Absolute, out var webUrl)) throw new InvalidOperationException("Configure PublicWebUrl.");
if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing"))
{
    if (webUrl.Scheme != "https") throw new InvalidOperationException("Production requires an HTTPS PublicWebUrl.");
    if (builder.Configuration["Mail:Mode"] != "Smtp" || string.IsNullOrWhiteSpace(builder.Configuration["Mail:Host"])) throw new InvalidOperationException("Production requires SMTP configuration.");
}
var app = builder.Build();
app.UseMiddleware<ErrorMiddleware>();
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
{
    app.UseHsts();
    app.Use(async (ctx, next) => { if (!ctx.Request.IsHttps) throw new ApiException(400, "https_required", "يلزم اتصال HTTPS."); await next(ctx); });
}
app.UseCors(); app.UseRateLimiter(); app.UseAuthentication(); app.UseMiddleware<SessionMiddleware>();
app.Use(async (ctx, next) => { if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store"; await next(ctx); });
app.MapGet("/health", async (AppDb db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapAuth(); app.MapStudy(); app.MapGpa(); app.MapAdmin(); app.MapPdf(); app.MapGeneration(); app.MapQuiz();
if (app.Configuration.GetValue("Database:Initialize", false))
{
    using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    await db.Database.MigrateAsync(); await DatabaseSetup.SeedAsync(db);
}
app.Run();
public partial class Program;
