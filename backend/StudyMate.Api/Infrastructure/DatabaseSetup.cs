using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Features;

namespace StudyMate.Api.Infrastructure;

public static class DatabaseSetup
{
    public static async Task SeedAsync(AppDb db)
    {
        if (!await db.Settings.AnyAsync()) db.Settings.Add(new ServiceSettings());
        if (!await db.Scales.AnyAsync()) db.Scales.Add(new GradingScale
        {
            PointsJson = JsonSerializer.Serialize(GpaCalculator.HailPoints),
            SourceUrl = "https://www.uoh.edu.sa/Ar/Deanships/Deanship-A-R/Registration-Department/SiteAssets/Lists/Tabs/AllItems/اللائحة الدراسة والاختبارات للمرحلة الجامعية وقواعدها التنفيذية بجامعة حائل.pdf"
        });
        await db.SaveChangesAsync();
    }
}
