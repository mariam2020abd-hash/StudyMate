# StudyMate server

ASP.NET Core 10 and SQL Server implement the shared account and study APIs. Implementation is still in progress; see [the requirements ledger](../docs/implementation-status.md) for acceptance gaps.

## Local development

Requirements: .NET SDK 10 and SQL Server. On Windows, the development connection uses the `MSSQLLocalDB` LocalDB instance and the `StudyMateDevelopment` database. The development profile applies migrations and seeds settings plus the University of Hail grading scale. It does not create an administrator.

From the repository root:

```powershell
dotnet restore backend/StudyMate.slnx --configfile backend/NuGet.Config
dotnet run --project backend/StudyMate.Api --launch-profile http
```

The API listens on `http://localhost:5287`. Run `npm run dev` inside `website`; its development proxy forwards `/api` requests to that server. Set `VITE_API_URL` only when a different API origin is required, and allow that web origin in `CorsOrigins` on the server.

Development verification/reset messages are local JSON files in `StudyMate.Api/App_Data/mail`. They are not sent to external email addresses. Register in the web interface, open the link from the matching local message, and verify before signing in. These files contain temporary authentication links and are excluded from Git.

## OpenAI

Generation uses the official Responses API with a strict JSON schema, source-page citations, and `store: false`. Configure the following environment variables on the server before launch:

```powershell
$env:OpenAI__ApiKey = '<server secret>'
$env:OpenAI__Model = '<model available to your OpenAI project with structured-output support>'
```

Do not put the key in frontend or mobile configuration, source control, or browser storage. Without both settings, new generation requests return `generation_unavailable` without reserving quota. Archived results remain readable. No live OpenAI request has yet been verified in this workspace.

The implementation follows [OpenAI Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs). The server validates the response and exact supporting quotations, but a quotation match alone does not prove semantic correctness of every generated claim; model-quality and prompt-injection acceptance tests remain required.

## Tests

```powershell
dotnet test backend/StudyMate.slnx
```

Integration fixtures create randomly named `StudyMateTests_<guid>` SQL databases and drop only those exact validated names afterward. Set `STUDYMATE_TEST_SQL` to a dedicated test SQL connection when LocalDB is unavailable. Never point tests at a production account. Generation tests use an in-process test provider and HTTP handlers; no OpenAI usage or external email is incurred.

## Production work remaining

Production startup requires an HTTPS `PublicWebUrl` and SMTP configuration (`Mail:Mode=Smtp`, `Mail:Host`, `Mail:Port`, `Mail:Username`, `Mail:Password`, `Mail:From`). SQL connections, encryption, Data Protection key protection, deployment migrations, administrator bootstrap, encrypted backups and restore drills, monitoring, and performance acceptance must be completed before deployment. Do not enable `Database:Initialize` as an unreviewed deployment shortcut.

Sources are private SQL `varbinary(max)` data; migrations, data and backups must account for up to 20 MB per configured upload. Deleting study content removes active files, extracted text, generations and attempts. Daily usage is retained so deleting content cannot reset a student's consumed quota. Account deletion and backup tombstone handling remain pending.
