using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudyMate.Api.Infrastructure;
using static StudyMate.Api.Tests.ApiFixture;

namespace StudyMate.Api.Tests;

public sealed class ApiTests(ApiFixture fixture) : IClassFixture<ApiFixture>
{
    [Theory]
    [InlineData(7, false)]
    [InlineData(8, true)]
    [InlineData(128, true)]
    [InlineData(129, false)]
    public async Task Password_boundaries_apply_to_registration_login_and_reset(int length, bool valid)
    {
        var client = fixture.CreateClient(); var email = Guid.NewGuid() + "@example.test";
        var password = new string('a', length);
        var registration = await client.PostAsJsonAsync("/api/auth/register", new { email, password });
        Assert.Equal(valid ? HttpStatusCode.Accepted : HttpStatusCode.BadRequest, registration.StatusCode);
        if (!valid) return;
        (await client.PostAsJsonAsync("/api/auth/verify", new { token = await fixture.LatestToken(email) })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login", new { email, password })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/forgot-password", new { email })).EnsureSuccessStatusCode();
        var token = await fixture.LatestToken(email);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password", new { token, password = "1234567" })).StatusCode);
        (await client.PostAsJsonAsync("/api/auth/reset-password", new { token, password = "12345678" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login", new { email, password = "12345678" })).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Registration_requires_verification_and_tokens_cannot_be_reused()
    {
        var client = fixture.CreateClient(); var email = Guid.NewGuid()+"@example.test";
        var response = await client.PostAsJsonAsync("/api/auth/register", new { email, password = Password, role = "admin" });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password })).StatusCode);
        var token = await fixture.LatestToken(email);
        (await client.PostAsJsonAsync("/api/auth/verify", new { token })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/verify", new { token })).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/register", new { email, password = Password })).StatusCode);
        var login = await Json(await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password }));
        Assert.Equal("student", login.GetProperty("user").GetProperty("role").GetString());
        using var scope = fixture.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        Assert.Equal(1, await db.Users.CountAsync(u => u.Email == email));
        Assert.NotEqual(Password, (await db.Users.SingleAsync(u => u.Email == email)).PasswordHash);
        Assert.DoesNotContain(token, string.Join("", await db.AccountTokens.Select(t => t.TokenHash).ToListAsync()));
    }

    [Fact]
    public async Task Logout_and_reset_invalidate_server_sessions()
    {
        var student = await fixture.Student(); var other = fixture.CreateClient();
        var login2 = await Json(await other.PostAsJsonAsync("/api/auth/login", new { email = student.Email, password = Password }));
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login2.GetProperty("token").GetString());
        (await student.Client.PostAsync("/api/auth/logout", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await student.Client.GetAsync("/api/me")).StatusCode);
        (await other.GetAsync("/api/me")).EnsureSuccessStatusCode();
        (await other.PostAsJsonAsync("/api/auth/forgot-password", new { email = student.Email })).EnsureSuccessStatusCode();
        var token = await fixture.LatestToken(student.Email); const string next = "Changed.Test.Password.2026";
        (await other.PostAsJsonAsync("/api/auth/reset-password", new { token, password = next })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await other.PostAsJsonAsync("/api/auth/reset-password", new { token, password = next })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.PostAsJsonAsync("/api/auth/login", new { email = student.Email, password = Password })).StatusCode);
        (await other.PostAsJsonAsync("/api/auth/login", new { email = student.Email, password = next })).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Ownership_filters_and_admin_boundaries_protect_study_records()
    {
        var first = await fixture.Student(); var second = await fixture.Student(); var admin = await fixture.Administrator();
        var course = await Json(await first.Client.PostAsJsonAsync("/api/study/courses", new { name = "مقرر خاص" }));
        var id = course.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await second.Client.PutAsJsonAsync($"/api/study/courses/{id}", new { name = "تغيير", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await second.Client.PostAsJsonAsync($"/api/study/courses/{id}/chapters", new { title = "تسلل" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/study/dashboard")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await first.Client.GetAsync("/api/admin/accounts")).StatusCode);
        var secondDashboard = await Json(await second.Client.GetAsync("/api/study/dashboard")); Assert.Empty(secondDashboard.GetProperty("courses").EnumerateArray());
    }

    [Fact]
    public async Task Stale_edits_fail_and_two_devices_read_the_same_saved_state()
    {
        var s = await fixture.Student(); var second = fixture.CreateClient(); second.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", s.Token);
        var course = await Json(await s.Client.PostAsJsonAsync("/api/study/courses", new { name = "الإصدار الأول" })); var id = course.GetProperty("id").GetGuid();
        var updated = await Json(await s.Client.PutAsJsonAsync($"/api/study/courses/{id}", new { name = "الإصدار الثاني", version = 1 }));
        Assert.Equal(2, updated.GetProperty("version").GetInt64());
        Assert.Equal(HttpStatusCode.Conflict, (await second.PutAsJsonAsync($"/api/study/courses/{id}", new { name = "تعديل قديم", version = 1 })).StatusCode);
        var dashboard = await Json(await second.GetAsync("/api/study/dashboard")); Assert.Equal("الإصدار الثاني", dashboard.GetProperty("courses")[0].GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await second.DeleteAsync($"/api/study/courses/{id}?version=1&confirm=true")).StatusCode);
    }

    [Fact]
    public async Task Course_deletion_cascades_chapters_and_detaches_goals_and_tasks()
    {
        var s = await fixture.Student(); var course = await Json(await s.Client.PostAsJsonAsync("/api/study/courses", new { name = "محذوف" })); var id = course.GetProperty("id").GetGuid();
        var chapter = await Json(await s.Client.PostAsJsonAsync($"/api/study/courses/{id}/chapters", new { title = "شابتر" }));
        var goal = await Json(await s.Client.PostAsJsonAsync("/api/study/goals", new { title = "هدف مستقل", courseId = id }));
        await Json(await s.Client.PostAsJsonAsync("/api/study/tasks", new { title = "مهمة", courseId = id, goalId = goal.GetProperty("id").GetGuid() }));
        (await s.Client.DeleteAsync($"/api/study/courses/{id}?version=1&confirm=true")).EnsureSuccessStatusCode();
        var dashboard = await Json(await s.Client.GetAsync("/api/study/dashboard"));
        Assert.Empty(dashboard.GetProperty("courses").EnumerateArray());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, dashboard.GetProperty("goals")[0].GetProperty("courseId").ValueKind);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, dashboard.GetProperty("tasks")[0].GetProperty("courseId").ValueKind);
    }

    [Fact]
    public async Task Goal_progress_and_chapter_review_are_independent()
    {
        var s = await fixture.Student(); var course = await Json(await s.Client.PostAsJsonAsync("/api/study/courses", new { name = "مقرر" })); var id = course.GetProperty("id").GetGuid();
        var chapter = await Json(await s.Client.PostAsJsonAsync($"/api/study/courses/{id}/chapters", new { title = "شابتر" }));
        var goal = await Json(await s.Client.PostAsJsonAsync("/api/study/goals", new { title = "أربع مهام" })); var goalId = goal.GetProperty("id").GetGuid();
        for (var i = 0; i < 4; i++) await Json(await s.Client.PostAsJsonAsync("/api/study/tasks", new { title = "مهمة " + i, goalId, completed = i < 2 }));
        var dashboard = await Json(await s.Client.GetAsync("/api/study/dashboard"));
        Assert.Equal(50, dashboard.GetProperty("goals")[0].GetProperty("progress").GetInt32()); Assert.Equal(0, dashboard.GetProperty("progress").GetInt32());
        await Json(await s.Client.PutAsJsonAsync($"/api/study/chapters/{chapter.GetProperty("id").GetGuid()}", new { title = "شابتر", reviewed = true, version = 1 }));
        dashboard = await Json(await s.Client.GetAsync("/api/study/dashboard"));
        Assert.Equal(50, dashboard.GetProperty("goals")[0].GetProperty("progress").GetInt32()); Assert.Equal(100, dashboard.GetProperty("progress").GetInt32());
    }

    [Fact]
    public async Task Hail_gpa_is_credit_weighted_and_unsupported_grades_are_rejected()
    {
        var s = await fixture.Student(); var term = await Json(await s.Client.PostAsJsonAsync("/api/study/terms", new { name = "الفصل الأول", priorGpa = 3, priorCredits = 30 })); var id = term.GetProperty("id").GetGuid();
        await Json(await s.Client.PostAsJsonAsync($"/api/study/terms/{id}/courses", new { name = "الأولى", code = "CS101", credits = 3, grade = "A" }));
        await Json(await s.Client.PostAsJsonAsync($"/api/study/terms/{id}/courses", new { name = "الثانية", code = "CS102", credits = 2, grade = "B" }));
        var terms = await Json(await s.Client.GetAsync("/api/study/terms")); var result = terms[0].GetProperty("result");
        Assert.Equal(3.45m, result.GetProperty("termGpa").GetDecimal()); Assert.Equal(3.06m, result.GetProperty("cumulativeGpa").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest, (await s.Client.PostAsJsonAsync($"/api/study/terms/{id}/courses", new { name = "غير مكتمل", code = "CS103", credits = 2, grade = "IC" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await s.Client.PostAsJsonAsync($"/api/study/terms/{id}/courses", new { name = "ساعات خاطئة", code = "CS104", credits = 0, grade = "A" })).StatusCode);
    }

    [Fact]
    public async Task Disabling_account_revokes_access_and_leaves_a_content_free_audit()
    {
        var s = await fixture.Student(); var admin = await fixture.Administrator();
        var account = (await Json(await admin.GetAsync($"/api/admin/accounts?query={s.Id}")))[0];
        await Json(await admin.PutAsJsonAsync($"/api/admin/accounts/{s.Id}/state", new { active = false, version = account.GetProperty("version").GetInt64(), reason = "اختبار تعطيل" }));
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.Client.GetAsync("/api/me")).StatusCode);
        var audit = await Json(await admin.GetAsync("/api/admin/audit")); Assert.Contains(audit.EnumerateArray(), item => item.GetProperty("targetId").GetGuid() == s.Id && item.GetProperty("action").GetString() == "account.state");
        Assert.DoesNotContain(Password, audit.GetRawText());
    }

    [Fact]
    public async Task Invalid_prior_gpa_and_foreign_links_are_rejected()
    {
        var a = await fixture.Student(); var b = await fixture.Student();
        var goal = await Json(await a.Client.PostAsJsonAsync("/api/study/goals", new { title = "خاص" }));
        Assert.Equal(HttpStatusCode.NotFound, (await b.Client.PostAsJsonAsync("/api/study/tasks", new { title = "رابط خاطئ", goalId = goal.GetProperty("id").GetGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Client.PostAsJsonAsync("/api/study/terms", new { name = "فصل", priorGpa = 5, priorCredits = 20 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Client.PostAsJsonAsync("/api/study/terms", new { name = "فصل", priorGpa = 3 })).StatusCode);
    }
}
