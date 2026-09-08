using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

namespace StudyMate.Api.Features;

public sealed record TermRequest(string Name, decimal? PriorGpa, decimal? PriorCredits, long Version = 0);
public sealed record GradeRequest(string Name, string Code, decimal Credits, string Grade, long Version = 0);

public static class GpaCalculator
{
    public static readonly IReadOnlyDictionary<string, decimal> HailPoints = new Dictionary<string, decimal>
    { ["A+"] = 4m, ["A"] = 3.75m, ["B+"] = 3.5m, ["B"] = 3m, ["C+"] = 2.5m, ["C"] = 2m, ["D+"] = 1.5m, ["D"] = 1m, ["F"] = 0m };

    public static void Prior(decimal? gpa, decimal? credits, decimal maximum)
    {
        if (gpa.HasValue != credits.HasValue) throw ApiException.Invalid("أدخل المعدل السابق وساعاته معًا.", "priorGpa");
        if (gpa is < 0 || gpa > maximum || credits is <= 0 or > 10000) throw ApiException.Invalid("المعدل أو الساعات السابقة خارج النطاق المدعوم.", "priorGpa");
    }
    public static GpaResult Calculate(IEnumerable<GradeCourse> courses, IReadOnlyDictionary<string, decimal> scale, decimal maximum, decimal? priorGpa, decimal? priorCredits)
    {
        Prior(priorGpa, priorCredits, maximum);
        decimal points = 0, credits = 0;
        foreach (var c in courses)
        {
            if (c.Credits <= 0 || !scale.TryGetValue(c.Grade, out var weight)) throw ApiException.Invalid("يوجد تقدير أو ساعات غير مدعومة.", "grade");
            points += c.Credits * weight; credits += c.Credits;
        }
        var combinedCredits = credits + (priorCredits ?? 0);
        return new GpaResult(points, credits,
            credits == 0 ? null : Math.Round(points / credits, 2, MidpointRounding.AwayFromZero),
            combinedCredits == 0 ? null : Math.Round((points + (priorGpa ?? 0) * (priorCredits ?? 0)) / combinedCredits, 2, MidpointRounding.AwayFromZero));
    }
}
public sealed record GpaResult(decimal Points, decimal Credits, decimal? TermGpa, decimal? CumulativeGpa);

public static class GpaEndpoints
{
    public static void MapGpa(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.StudentGroup();
        group.MapGet("/terms", async (AppDb db) =>
        {
            var terms = await db.Terms.OrderBy(x => x.CreatedAt).ToListAsync();
            var courses = await db.GradeCourses.OrderBy(x => x.CreatedAt).ToListAsync();
            var scales = await db.Scales.AsNoTracking().ToListAsync();
            return terms.Select(t =>
            {
                var scale = scales.Single(s => s.Id == t.ScaleId); var items = courses.Where(c => c.TermId == t.Id).ToArray();
                return new { t.Id, t.Name, t.Version, t.PriorGpa, t.PriorCredits, scale = ScaleView(scale), courses = items.Select(GradeView), result = GpaCalculator.Calculate(items, Points(scale), scale.Maximum, t.PriorGpa, t.PriorCredits) };
            });
        });
        group.MapGet("/scales", async (AppDb db) => (await db.Scales.AsNoTracking().Where(x => x.Active).ToListAsync()).Select(ScaleView));
        group.MapPost("/terms", async (TermRequest r, AppDb db, CurrentUser actor) =>
        {
            var scale = await db.Scales.SingleAsync(s => s.Active);
            GpaCalculator.Prior(r.PriorGpa, r.PriorCredits, scale.Maximum);
            var term = new AcademicTerm { OwnerId = actor.RequireStudent(), Name = Validate.Text(r.Name, 100, "name"), ScaleId = scale.Id, PriorGpa = r.PriorGpa, PriorCredits = r.PriorCredits };
            db.Terms.Add(term); await db.SaveChangesAsync(); return Results.Created($"/api/study/terms/{term.Id}", term);
        });
        group.MapPut("/terms/{id:guid}", async (Guid id, TermRequest r, AppDb db) =>
        {
            var term = await db.Terms.SingleOrDefaultAsync(t => t.Id == id) ?? throw ApiException.NotFound(); Validate.Version(term, r.Version);
            var scale = await db.Scales.SingleAsync(s => s.Id == term.ScaleId); GpaCalculator.Prior(r.PriorGpa, r.PriorCredits, scale.Maximum);
            term.Name = Validate.Text(r.Name, 100, "name"); term.PriorGpa = r.PriorGpa; term.PriorCredits = r.PriorCredits;
            await db.SaveChangesAsync(); return term;
        });
        group.MapDelete("/terms/{id:guid}", async (Guid id, long version, bool confirm, AppDb db) =>
        {
            if (!confirm) throw ApiException.Invalid("أكد حذف الفصل ومواده.", "confirm");
            await using var tx = await db.Database.BeginTransactionAsync();
            var term = await db.Terms.SingleOrDefaultAsync(t => t.Id == id) ?? throw ApiException.NotFound(); Validate.Version(term, version);
            db.GradeCourses.RemoveRange(await db.GradeCourses.Where(c => c.TermId == id).ToListAsync()); db.Terms.Remove(term);
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent();
        });
        group.MapPost("/terms/{termId:guid}/courses", async (Guid termId, GradeRequest r, AppDb db, CurrentUser actor) =>
        {
            var term = await db.Terms.SingleOrDefaultAsync(t => t.Id == termId) ?? throw ApiException.NotFound();
            var course = new GradeCourse { OwnerId = actor.RequireStudent(), TermId = termId }; await Assign(db, course, term, r);
            db.GradeCourses.Add(course); await db.SaveChangesAsync(); return Results.Created($"/api/study/grade-courses/{course.Id}", GradeView(course));
        });
        group.MapPut("/grade-courses/{id:guid}", async (Guid id, GradeRequest r, AppDb db) =>
        {
            var course = await db.GradeCourses.SingleOrDefaultAsync(c => c.Id == id) ?? throw ApiException.NotFound(); Validate.Version(course, r.Version);
            var term = await db.Terms.SingleAsync(t => t.Id == course.TermId); await Assign(db, course, term, r);
            await db.SaveChangesAsync(); return GradeView(course);
        });
        group.MapDelete("/grade-courses/{id:guid}", async (Guid id, long version, AppDb db) =>
        {
            var course = await db.GradeCourses.SingleOrDefaultAsync(c => c.Id == id) ?? throw ApiException.NotFound(); Validate.Version(course, version);
            db.GradeCourses.Remove(course); await db.SaveChangesAsync(); return Results.NoContent();
        });
    }
    public static IReadOnlyDictionary<string, decimal> Points(GradingScale s) => JsonSerializer.Deserialize<Dictionary<string, decimal>>(s.PointsJson)!;
    public static object ScaleView(GradingScale s) => new { s.Id, s.Name, s.Version, s.Maximum, s.SourceUrl, points = Points(s) };
    public static object GradeView(GradeCourse c) => new { c.Id, c.TermId, c.Name, c.Code, c.Credits, c.Grade, c.Version };
    private static async Task Assign(AppDb db, GradeCourse c, AcademicTerm t, GradeRequest r)
    {
        if (r.Credits is <= 0 or > 100 || decimal.Round(r.Credits, 2) != r.Credits) throw ApiException.Invalid("أدخل ساعات موجبة حتى 100 بمنزلتين عشريتين كحد أقصى.", "credits");
        var scale = await db.Scales.SingleAsync(s => s.Id == t.ScaleId);
        var grade = Validate.Text(r.Grade, 5, "grade").ToUpperInvariant();
        if (!Points(scale).ContainsKey(grade)) throw ApiException.Invalid("هذا التقدير غير مدعوم. لا تحسب الحاسبة حالات الإعادة والتقديرات الخاصة.", "grade");
        var code = Validate.Text(r.Code, 30, "code").ToUpperInvariant();
        if (await db.GradeCourses.AnyAsync(g => g.Id != c.Id && g.Code == code)) throw ApiException.Invalid("المادة مضافة بالفعل. حالات الإعادة غير مدعومة قبل اعتماد قواعدها.", "code");
        c.Name = Validate.Text(r.Name, 100, "name"); c.Code = code; c.Credits = r.Credits; c.Grade = grade;
    }
}
