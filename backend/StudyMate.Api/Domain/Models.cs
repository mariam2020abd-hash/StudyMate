namespace StudyMate.Api.Domain;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public long Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public abstract class OwnedEntity : Entity
{
    public Guid OwnerId { get; set; }
}

public sealed class User : Entity
{
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "student";
    public string Language { get; set; } = "ar";
    public bool Verified { get; set; }
    public bool Active { get; set; } = true;
    public DateTime? DeletedAt { get; set; }
    public int FailedSignIns { get; set; }
    public DateTime? FailureWindowStart { get; set; }
    public DateTime? LockedUntil { get; set; }
}

public sealed class Session : Entity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public sealed class AccountToken : Entity
{
    public Guid UserId { get; set; }
    public string Purpose { get; set; } = "verify";
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

public sealed class MailMessage : Entity
{
    public string Recipient { get; set; } = "";
    public string Subject { get; set; } = "";
    // Protected using ASP.NET Data Protection, never included in operational logs.
    public string ProtectedBody { get; set; } = "";
    public DateTime? DeliveredAt { get; set; }
    public int Attempts { get; set; }
    public DateTime NextAttemptAt { get; set; } = DateTime.UtcNow;
}

public sealed class Course : OwnedEntity { public string Name { get; set; } = ""; }
public sealed class Chapter : OwnedEntity
{
    public Guid CourseId { get; set; }
    public string Title { get; set; } = "";
    public bool Reviewed { get; set; }
    public string Status { get; set; } = "empty";
    public string? ErrorCode { get; set; }
}
public sealed class Goal : OwnedEntity
{
    public string Title { get; set; } = "";
    public DateOnly? DueDate { get; set; }
    public Guid? CourseId { get; set; }
    public bool Completed { get; set; }
}
public sealed class StudyTask : OwnedEntity
{
    public string Title { get; set; } = "";
    public DateOnly? DueDate { get; set; }
    public Guid? CourseId { get; set; }
    public Guid? GoalId { get; set; }
    public bool Completed { get; set; }
    public DateTime? CompletedAt { get; set; }
}
public sealed class AcademicTerm : OwnedEntity
{
    public string Name { get; set; } = "";
    public Guid ScaleId { get; set; }
    public decimal? PriorGpa { get; set; }
    public decimal? PriorCredits { get; set; }
}
public sealed class GradeCourse : OwnedEntity
{
    public Guid TermId { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public decimal Credits { get; set; }
    public string Grade { get; set; } = "";
}
public sealed class GradingScale : Entity
{
    public string Name { get; set; } = "University of Hail";
    public decimal Maximum { get; set; } = 4;
    public string PointsJson { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public bool Active { get; set; } = true;
}
public sealed class ServiceSettings : Entity
{
    public int DailyQuota { get; set; } = 10;
    public int MaxPdfBytes { get; set; } = 20_000_000;
    public int MaxPdfPages { get; set; } = 100;
    public int QuizQuestions { get; set; } = 10;
}
public sealed class AuditEvent : Entity
{
    public Guid ActorId { get; set; }
    public string Action { get; set; } = "";
    public Guid TargetId { get; set; }
    public string Reason { get; set; } = "";
    public string BeforeJson { get; set; } = "{}";
    public string AfterJson { get; set; } = "{}";
}

// SQL Server stores the private original atomically with its metadata. It is never served statically.
public sealed class ChapterSource : OwnedEntity
{
    public Guid ChapterId { get; set; }
    public byte[] Content { get; set; } = [];
    public string Sha256 { get; set; } = "";
    public int ByteCount { get; set; }
    public int PageLimit { get; set; }
    public int PageCount { get; set; }
    public string Status { get; set; } = "queued";
    public string? ErrorCode { get; set; }
    public string PagesJson { get; set; } = "[]";
    public DateTime? LeaseUntil { get; set; }
    public Guid? LeaseId { get; set; }
}

public sealed class DailyUsage : OwnedEntity
{
    public DateOnly Day { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
}

public sealed class GenerationJob : OwnedEntity
{
    public Guid ChapterId { get; set; }
    public Guid SourceId { get; set; }
    public Guid RequestKey { get; set; }
    public DateOnly QuotaDay { get; set; }
    public string Kind { get; set; } = "summary";
    public string Language { get; set; } = "ar";
    public int QuestionCount { get; set; }
    public string Status { get; set; } = "queued";
    public string? ErrorCode { get; set; }
    public DateTime Deadline { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? LeaseId { get; set; }
    // Immutable validated server payload, including quiz keys. Never serialize the entity to a student.
    public string ResultJson { get; set; } = "";
}

public sealed class QuizAttempt : OwnedEntity
{
    public Guid JobId { get; set; }
    public Guid RequestKey { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public Guid? SubmitKey { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public int? CorrectCount { get; set; }
    public int Total { get; set; }
}
