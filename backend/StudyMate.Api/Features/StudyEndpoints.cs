using Microsoft.EntityFrameworkCore;
using StudyMate.Api.Domain;
using StudyMate.Api.Infrastructure;
using StudyMate.Api.Security;

namespace StudyMate.Api.Features;

public sealed record NameRequest(string Name, long Version = 0);
public sealed record ChapterRequest(string Title, bool Reviewed = false, long Version = 0);
public sealed record GoalRequest(string Title, DateOnly? DueDate, Guid? CourseId, bool Completed = false, long Version = 0);
public sealed record TaskRequest(string Title, DateOnly? DueDate, Guid? CourseId, Guid? GoalId, bool Completed = false, long Version = 0);

public static class StudyEndpoints
{
    public static RouteGroupBuilder StudentGroup(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/study");
        group.AddEndpointFilter(async (context, next) =>
        { context.HttpContext.RequestServices.GetRequiredService<CurrentUser>().RequireStudent(); return await next(context); });
        return group;
    }

    public static void MapStudy(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.StudentGroup();
        group.MapGet("/dashboard", async (AppDb db) =>
        {
            var courses = await db.Courses.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToListAsync();
            var chapters = await db.Chapters.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).ToListAsync();
            var goals = await db.Goals.OrderBy(x => x.CreatedAt).ToListAsync();
            var tasks = await db.Tasks.OrderBy(x => x.CreatedAt).ToListAsync();
            var completed = chapters.Count(x => x.Reviewed);
            var next = courses.SelectMany(c => chapters.Where(ch => ch.CourseId == c.Id)).FirstOrDefault(ch => !ch.Reviewed);
            return new
            {
                courses = courses.Select(c => new { c.Id, c.Name, c.Version, c.CreatedAt, chapters = chapters.Where(ch => ch.CourseId == c.Id).Select(ChapterView) }),
                completed, progress = chapters.Count == 0 ? 0 : (int)Math.Round(100m * completed / chapters.Count, MidpointRounding.AwayFromZero),
                nextChapterId = next?.Id,
                goals = goals.Select(g => new { g.Id, g.Title, g.DueDate, g.CourseId, g.Completed, g.Version, progress = GoalProgress(g, tasks) }),
                tasks = tasks.Select(TaskView),
                recentAchievements = tasks.Where(t => t.Completed).OrderByDescending(t => t.CompletedAt).Take(5).Select(TaskView)
            };
        });
        group.MapPost("/courses", async (NameRequest request, AppDb db, CurrentUser actor) =>
        {
            var course = new Course { OwnerId = actor.RequireStudent(), Name = Validate.Text(request.Name, 80, "name") };
            db.Courses.Add(course); await db.SaveChangesAsync();
            return Results.Created($"/api/study/courses/{course.Id}", CourseView(course));
        });
        group.MapPut("/courses/{id:guid}", async (Guid id, NameRequest request, AppDb db) =>
        {
            var course = await db.Courses.SingleOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound();
            Validate.Version(course, request.Version); course.Name = Validate.Text(request.Name, 80, "name");
            await db.SaveChangesAsync(); return CourseView(course);
        });
        group.MapDelete("/courses/{id:guid}", async (Guid id, long version, bool confirm, AppDb db) =>
        {
            if (!confirm) throw ApiException.Invalid("أكد حذف المقرر ومحتواه.", "confirm");
            await using var tx = await db.Database.BeginTransactionAsync();
            var course = await db.Courses.SingleOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound();
            Validate.Version(course, version);
            await GenerationDeletion.RemoveForChapters(db, await db.Chapters.Where(ch => ch.CourseId == id).Select(ch => ch.Id).ToArrayAsync());
            foreach (var goal in await db.Goals.Where(g => g.CourseId == id).ToListAsync()) goal.CourseId = null;
            foreach (var task in await db.Tasks.Where(g => g.CourseId == id).ToListAsync()) task.CourseId = null;
            db.Sources.RemoveRange(await db.Sources.Where(s => db.Chapters.Any(ch => ch.Id == s.ChapterId && ch.CourseId == id)).ToListAsync());
            db.Chapters.RemoveRange(await db.Chapters.Where(ch => ch.CourseId == id).ToListAsync());
            db.Courses.Remove(course); await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.NoContent();
        });
        group.MapPost("/courses/{courseId:guid}/chapters", async (Guid courseId, ChapterRequest request, AppDb db, CurrentUser actor) =>
        {
            await CourseExists(db, courseId);
            var chapter = new Chapter { OwnerId = actor.RequireStudent(), CourseId = courseId, Title = Validate.Text(request.Title, 100, "title") };
            db.Chapters.Add(chapter); await db.SaveChangesAsync();
            return Results.Created($"/api/study/chapters/{chapter.Id}", ChapterView(chapter));
        });
        group.MapPut("/chapters/{id:guid}", async (Guid id, ChapterRequest request, AppDb db) =>
        {
            var chapter = await db.Chapters.SingleOrDefaultAsync(ch => ch.Id == id) ?? throw ApiException.NotFound();
            Validate.Version(chapter, request.Version); chapter.Title = Validate.Text(request.Title, 100, "title"); chapter.Reviewed = request.Reviewed;
            await db.SaveChangesAsync(); return ChapterView(chapter);
        });
        group.MapDelete("/chapters/{id:guid}", async (Guid id, long version, bool confirm, AppDb db) =>
        {
            if (!confirm) throw ApiException.Invalid("أكد حذف الشابتر ومحتواه.", "confirm");
            await using var tx = await db.Database.BeginTransactionAsync();
            var chapter = await db.Chapters.SingleOrDefaultAsync(ch => ch.Id == id) ?? throw ApiException.NotFound();
            Validate.Version(chapter, version);
            await GenerationDeletion.RemoveForChapters(db, [id]);
            db.Sources.RemoveRange(await db.Sources.Where(s => s.ChapterId == id).ToListAsync());
            db.Chapters.Remove(chapter); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent();
        });
        group.MapPost("/goals", async (GoalRequest r, AppDb db, CurrentUser actor) =>
        {
            await CourseExists(db, r.CourseId);
            var goal = new Goal { OwnerId = actor.RequireStudent(), Title = Validate.Text(r.Title, 200, "title"), DueDate = r.DueDate, CourseId = r.CourseId, Completed = r.Completed };
            db.Goals.Add(goal); await db.SaveChangesAsync(); return Results.Created($"/api/study/goals/{goal.Id}", goal);
        });
        group.MapPut("/goals/{id:guid}", async (Guid id, GoalRequest r, AppDb db) =>
        {
            var goal = await db.Goals.SingleOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound();
            Validate.Version(goal, r.Version); await CourseExists(db, r.CourseId);
            if (r.Completed != goal.Completed && await db.Tasks.AnyAsync(t => t.GoalId == id)) throw ApiException.Invalid("إنجاز هذا الهدف محسوب من مهامه.", "completed");
            goal.Title = Validate.Text(r.Title, 200, "title"); goal.CourseId = r.CourseId; goal.DueDate = r.DueDate; goal.Completed = r.Completed;
            await db.SaveChangesAsync(); return goal;
        });
        group.MapDelete("/goals/{id:guid}", async (Guid id, long version, bool confirm, AppDb db) =>
        {
            if (!confirm) throw ApiException.Invalid("أكد حذف الهدف ومهامه.", "confirm");
            await using var tx = await db.Database.BeginTransactionAsync();
            var goal = await db.Goals.SingleOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound(); Validate.Version(goal, version);
            db.Tasks.RemoveRange(await db.Tasks.Where(t => t.GoalId == id).ToListAsync()); db.Goals.Remove(goal);
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.NoContent();
        });
        group.MapPost("/tasks", async (TaskRequest r, AppDb db, CurrentUser actor, TimeProvider clock) =>
        {
            await LinksExist(db, r);
            var task = new StudyTask { OwnerId = actor.RequireStudent() }; AssignTask(task, r, clock);
            db.Tasks.Add(task); await db.SaveChangesAsync(); return Results.Created($"/api/study/tasks/{task.Id}", TaskView(task));
        });
        group.MapPut("/tasks/{id:guid}", async (Guid id, TaskRequest r, AppDb db, TimeProvider clock) =>
        {
            var task = await db.Tasks.SingleOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound();
            Validate.Version(task, r.Version); await LinksExist(db, r); AssignTask(task, r, clock);
            await db.SaveChangesAsync(); return TaskView(task);
        });
        group.MapDelete("/tasks/{id:guid}", async (Guid id, long version, AppDb db) =>
        {
            var task = await db.Tasks.SingleOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound(); Validate.Version(task, version);
            db.Tasks.Remove(task); await db.SaveChangesAsync(); return Results.NoContent();
        });
    }

    public static object CourseView(Course c) => new { c.Id, c.Name, c.Version, c.CreatedAt };
    public static object ChapterView(Chapter c) => new { c.Id, c.CourseId, c.Title, c.Reviewed, c.Status, c.ErrorCode, c.Version, c.CreatedAt };
    public static object TaskView(StudyTask t) => new { t.Id, t.Title, t.CourseId, t.GoalId, t.DueDate, t.Completed, t.CompletedAt, t.Version };
    public static int GoalProgress(Goal goal, IEnumerable<StudyTask> all)
    {
        var tasks = all.Where(t => t.GoalId == goal.Id).ToArray();
        return tasks.Length == 0 ? (goal.Completed ? 100 : 0) : (int)Math.Round(100m * tasks.Count(t => t.Completed) / tasks.Length, MidpointRounding.AwayFromZero);
    }
    private static void AssignTask(StudyTask task, TaskRequest r, TimeProvider clock)
    {
        task.Title = Validate.Text(r.Title, 200, "title"); task.CourseId = r.CourseId; task.GoalId = r.GoalId; task.DueDate = r.DueDate;
        task.CompletedAt = r.Completed ? (task.CompletedAt ?? clock.GetUtcNow().UtcDateTime) : null; task.Completed = r.Completed;
    }
    private static async Task LinksExist(AppDb db, TaskRequest request)
    {
        await CourseExists(db, request.CourseId);
        if (request.GoalId != null && !await db.Goals.AnyAsync(x => x.Id == request.GoalId)) throw ApiException.NotFound();
    }
    public static async Task CourseExists(AppDb db, Guid? courseId)
    { if (courseId != null && !await db.Courses.AnyAsync(c => c.Id == courseId)) throw ApiException.NotFound(); }
}
