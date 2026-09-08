using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace StudyMate.Api.Infrastructure;

public sealed class ApiException(int status, string code, string message, string? field = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public string? Field { get; } = field;
    public static ApiException NotFound() => new(404, "not_found", "العنصر غير موجود.");
    public static ApiException Conflict() => new(409, "conflict", "تغيرت البيانات على جهاز آخر. أعد تحميلها قبل التعديل.");
    public static ApiException Invalid(string message, string? field = null) => new(400, "validation", message, field);
}

public sealed class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (Exception ex)
        {
            if (context.Response.HasStarted) throw;
            var error = ex switch
            {
                ApiException a => a,
                DbUpdateConcurrencyException => ApiException.Conflict(),
                DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } } => new ApiException(409, "duplicate", "هذه البيانات موجودة بالفعل."),
                BadHttpRequestException => ApiException.Invalid("تعذّر قراءة الطلب. تحقق من المدخلات."),
                _ => new ApiException(500, "internal_error", "تعذّر إكمال العملية. حاول مرة أخرى.")
            };
            // Never log request bodies, source text, passwords, tokens or provider output.
            if (error.Status == 500) logger.LogError("Request {TraceId} failed with {Type}", context.TraceIdentifier, ex.GetType().Name);
            context.Response.StatusCode = error.Status;
            await context.Response.WriteAsJsonAsync(new { error = new { error.Code, message = error.Message, error.Field, traceId = context.TraceIdentifier } });
        }
    }
}

public static class Validate
{
    public static string Text(string? value, int maximum, string field)
    {
        var text = value?.Trim() ?? "";
        if (text.Length == 0 || text.Length > maximum) throw ApiException.Invalid($"أدخل نصًا بين 1 و{maximum} محرفًا.", field);
        return text;
    }
    public static void Version(Domain.Entity entity, long version)
    { if (entity.Version != version) throw ApiException.Conflict(); }
    public static string Language(string value) => value is "ar" or "en" ? value : throw ApiException.Invalid("اختر العربية أو الإنجليزية.", "language");
}
