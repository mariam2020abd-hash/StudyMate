using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using StudyMate.Api.Domain;
using StudyMate.Api.Security;

namespace StudyMate.Api.Infrastructure;

public sealed class AppDb(DbContextOptions<AppDb> options, CurrentUser actor) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<AccountToken> AccountTokens => Set<AccountToken>();
    public DbSet<MailMessage> MailMessages => Set<MailMessage>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<StudyTask> Tasks => Set<StudyTask>();
    public DbSet<AcademicTerm> Terms => Set<AcademicTerm>();
    public DbSet<GradeCourse> GradeCourses => Set<GradeCourse>();
    public DbSet<GradingScale> Scales => Set<GradingScale>();
    public DbSet<ServiceSettings> Settings => Set<ServiceSettings>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<ChapterSource> Sources => Set<ChapterSource>();
    public DbSet<DailyUsage> Usage => Set<DailyUsage>();
    public DbSet<GenerationJob> Jobs => Set<GenerationJob>();
    public DbSet<QuizAttempt> Attempts => Set<QuizAttempt>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<User>().Property(x => x.FirebaseUid).HasMaxLength(128).UseCollation("Latin1_General_100_BIN2");
        b.Entity<User>().HasIndex(x => x.FirebaseUid).IsUnique().HasFilter("[FirebaseUid] IS NOT NULL");
        b.Entity<User>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<User>().Property(x => x.PasswordHash).HasMaxLength(512);
        b.Entity<User>().Property(x => x.Role).HasMaxLength(20);
        b.Entity<Session>().Property(x => x.TokenHash).HasMaxLength(64);
        b.Entity<Session>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<Session>().HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        b.Entity<AccountToken>().Property(x => x.TokenHash).HasMaxLength(64);
        b.Entity<AccountToken>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<AccountToken>().HasOne<User>().WithMany().HasForeignKey(x => x.UserId);

        Own<Course>(b); Own<Chapter>(b); Own<Goal>(b); Own<StudyTask>(b);
        Own<AcademicTerm>(b); Own<GradeCourse>(b);
        Own<ChapterSource>(b);
        Own<DailyUsage>(b); Own<GenerationJob>(b);
        Own<QuizAttempt>(b);
        b.Entity<QuizAttempt>().HasIndex(x => new { x.OwnerId, x.RequestKey }).IsUnique();
        b.Entity<QuizAttempt>().HasOne<GenerationJob>().WithMany().HasForeignKey(x => x.JobId);
        b.Entity<DailyUsage>().HasIndex(x => new { x.OwnerId, x.Day }).IsUnique();
        b.Entity<GenerationJob>().HasIndex(x => new { x.OwnerId, x.RequestKey }).IsUnique();
        b.Entity<GenerationJob>().HasOne<Chapter>().WithMany().HasForeignKey(x => x.ChapterId);
        b.Entity<GenerationJob>().HasOne<ChapterSource>().WithMany().HasForeignKey(x => x.SourceId);
        b.Entity<ChapterSource>().HasIndex(x => x.ChapterId).IsUnique();
        b.Entity<ChapterSource>().HasOne<Chapter>().WithMany().HasForeignKey(x => x.ChapterId);
        b.Entity<ChapterSource>().Property(x => x.Sha256).HasMaxLength(64);
        b.Entity<Course>().Property(x => x.Name).HasMaxLength(80).UseCollation("Latin1_General_100_BIN2");
        b.Entity<Course>().HasIndex(x => new { x.OwnerId, x.Name }).IsUnique();
        b.Entity<Chapter>().Property(x => x.Title).HasMaxLength(100);
        b.Entity<Chapter>().HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId);
        b.Entity<Goal>().HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId);
        b.Entity<Goal>().Property(x => x.Title).HasMaxLength(200);
        b.Entity<StudyTask>().Property(x => x.Title).HasMaxLength(200);
        b.Entity<StudyTask>().HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId);
        b.Entity<StudyTask>().HasOne<Goal>().WithMany().HasForeignKey(x => x.GoalId);
        b.Entity<AcademicTerm>().Property(x => x.Name).HasMaxLength(100);
        b.Entity<AcademicTerm>().HasOne<GradingScale>().WithMany().HasForeignKey(x => x.ScaleId);
        b.Entity<GradeCourse>().HasOne<AcademicTerm>().WithMany().HasForeignKey(x => x.TermId);
        b.Entity<GradeCourse>().Property(x => x.Name).HasMaxLength(100);
        b.Entity<GradeCourse>().Property(x => x.Code).HasMaxLength(30);
        b.Entity<GradeCourse>().Property(x => x.Grade).HasMaxLength(5);
        foreach (var entity in b.Model.GetEntityTypes())
        {
            entity.FindProperty(nameof(Entity.Version))!.IsConcurrencyToken = true;
            foreach (var fk in entity.GetForeignKeys()) fk.DeleteBehavior = DeleteBehavior.Restrict;
            foreach (var p in entity.GetProperties().Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            { p.SetPrecision(12); p.SetScale(4); }
            // SQL datetime2 drops DateTime.Kind. All stored timestamps are UTC; restore the kind so repeated API reads retain Z.
            foreach (var p in entity.GetProperties().Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?)))
                p.SetValueConverter(new ValueConverter<DateTime, DateTime>(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc)));
        }
    }

    private void Own<T>(ModelBuilder b) where T : OwnedEntity
    {
        b.Entity<T>().HasQueryFilter(x => actor.Id != null && actor.Role == "student" && x.OwnerId == actor.Id);
        b.Entity<T>().HasIndex(x => new { x.OwnerId, x.CreatedAt });
        b.Entity<T>().HasOne<User>().WithMany().HasForeignKey(x => x.OwnerId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<Entity>().Where(x => x.State == EntityState.Modified))
            entry.Entity.Version = entry.OriginalValues.GetValue<long>(nameof(Entity.Version)) + 1;
        return base.SaveChangesAsync(cancellationToken);
    }
}
