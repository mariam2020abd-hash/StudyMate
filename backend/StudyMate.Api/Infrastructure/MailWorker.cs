using System.Net;
using System.Net.Mail;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace StudyMate.Api.Infrastructure;

public sealed class MailWorker(IServiceScopeFactory scopes, IConfiguration config, IWebHostEnvironment environment, ILogger<MailWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDb>();
                var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector("StudyMate.Mail.v1");
                var now = DateTime.UtcNow;
                var pending = await db.MailMessages.Where(m => m.DeliveredAt == null && m.NextAttemptAt <= now && m.Attempts < 10).OrderBy(m => m.CreatedAt).Take(10).ToListAsync(stoppingToken);
                foreach (var item in pending)
                {
                    try
                    {
                        var body = protector.Unprotect(item.ProtectedBody);
                        if (config["Mail:Mode"] == "DevelopmentFile" && environment.IsDevelopment())
                        {
                            var directory = Path.Combine(environment.ContentRootPath, "App_Data", "mail"); Directory.CreateDirectory(directory);
                            await File.WriteAllTextAsync(Path.Combine(directory, item.Id + ".json"), JsonSerializer.Serialize(new { item.Recipient, item.Subject, body }), stoppingToken);
                        }
                        else
                        {
                            using var smtp = new SmtpClient(config["Mail:Host"]!, config.GetValue("Mail:Port", 587))
                            { EnableSsl = true, Credentials = new NetworkCredential(config["Mail:Username"], config["Mail:Password"]) };
                            using var message = new System.Net.Mail.MailMessage(config["Mail:From"]!, item.Recipient, item.Subject, body);
                            await smtp.SendMailAsync(message, stoppingToken);
                        }
                        item.DeliveredAt = now; item.ProtectedBody = "";
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        item.Attempts++; item.NextAttemptAt = now.AddMinutes(Math.Min(60, 1 << Math.Min(item.Attempts, 6)));
                        logger.LogWarning("Mail delivery {MessageId} failed ({ErrorType})", item.Id, ex.GetType().Name);
                    }
                    await db.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { logger.LogWarning("Mail worker unavailable ({ErrorType})", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        }
    }
}
