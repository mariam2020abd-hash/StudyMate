# StudyMate SRS implementation evidence

Updated 2026-09-06. The objective remains implementation of the entire IEEE SRS. This ledger records partial evidence, not acceptance of the full product.

Authoritative specification: `output/srs/IEEE SRS.docx` and `output/srs/IEEE SRS.pdf` (31 requirements). The SRS describes the target; its initial implementation comparison predates the changes below.

| Requirements | Current evidence | Remaining acceptance work |
| --- | --- | --- |
| FR-01–03 accounts | ASP.NET endpoints, SQL tokens, password hashes, protected mail outbox; integration tests for verification, logout and reset | Additional lock/expiry/concurrent reset tests, real SMTP delivery, mobile flows |
| FR-04–06 courses and chapters | Owned CRUD with version conflicts; connected web search and review; SQL integration tests | Browser acceptance and connected mobile implementation |
| FR-07–08 PDF | Private SQL binary storage, durable processing leases, PdfPig 0.1.16 extraction, persisted page text, web upload/status/text preview; bilingual/protected/scanned/corrupt/size/page/deletion/recovery tests | Visual browser/mobile acceptance, more PDF edge cases, parser resource isolation |
| FR-09–11 explanation, summary, jobs and quota | Server-only Responses API adapter with strict schema and quote/page validation; durable jobs and SQL quota reservations; idempotency/concurrency/refund/timeout tests; web tabs and archive UI | Live provider/model quality and injection acceptance, browser generation flow, cancellation on deletion, mobile integration |
| FR-12–14 quizzes and attempts | Immutable job payloads; sanitized pre-submit quiz view; saved answers, server grading, idempotent submission, history and retakes; integration tests; web quiz forms | Browser quiz acceptance and mobile integration; broader concurrent submission tests |
| FR-15–16 progress and goals | Server manual review and tasks/goals; independent progress and course deletion tests; basic web forms | Complete editing forms, next-step UI and mobile parity |
| FR-17–18 GPA | SQL academic terms/grade courses; verified Hail scale; weighted decimal calculator and integration tests (3.45/3.06, invalid inputs) | Complete field editing, browser/mobile acceptance |
| FR-19–20 administration | Role boundaries, account disabling, settings/scales/audit endpoints; basic admin web forms | Operational aggregate metrics, scales/audit UI, deployment bootstrap |
| IR-01–02 interfaces | Shared authenticated APIs, stable IDs, optimistic concurrency and structured errors | Full web/mobile synchronization, localization and production integration acceptance |
| DR-01–02 ownership and immutable sources | Query filters and endpoint authorization tested against another student/admin; immutable chapter source and transactional deletion | Apply same invariants to generated content and attempts |
| DR-03 deletion | Course/chapter source deletion tested; late queued extraction does not recreate deleted rows | Account reauthentication/deletion, full generated-data cascade, backup tombstones and restore handling |
| NFR-01–02 security and AI | Hashed credentials, server sessions, rate limiting, HTTPS guard, no-store API responses | Production secret/key protection, prompt-injection defenses, structured AI validation and complete security tests |
| NFR-03–04 performance and operations | No full acceptance evidence | 100-user load scenario, generation timing, monitoring, encrypted daily backups, retention and restore drill |
| NFR-05–06 accessibility and platforms | Existing RTL web/mobile layouts; web typecheck passes | Keyboard/screen reader/200% checks, browser matrix and Android/iOS parity/runtime tests |

## Current verified commands

- `dotnet build backend/StudyMate.slnx --no-restore`: passed without compiler warnings/errors.
- `dotnet test backend/StudyMate.slnx --no-restore`: latest full run has 32 passing tests (SQL integration plus provider contract/validation tests). Each integration fixture uses and drops its own uniquely named test database.
- `npm run build` in `website`: passed after generation and quiz UI changes.
- In-app browser verified synthetic local registration, email verification, sign-in, course/chapter creation, upload and rendering of extracted Arabic/English page text. A full-page screenshot had apparent stitching artifacts; full visual/accessibility acceptance is not yet established.
- Original six web storage/search tests passed earlier; they do not prove the new connected user interface.

## Storage and processing decisions

Original PDFs are private `varbinary(max)` data in SQL Server, alongside immutable checksums and metadata. This makes an upload and its metadata atomic and lets chapter/course deletion remove the active original and extracted text transactionally. Download requires student ownership and is served as an attachment with `no-store`. Production SQL encryption and backup operations remain to be configured and validated.

The PDF worker claims a five-minute SQL lease, recovers expired leases after restart, and publishes results only while still owning that lease. A deleted record cannot be recreated by a late result. Full parser resource isolation remains pending; PDF size and page count limits alone do not establish protection against all malicious PDFs.

No live OpenAI generation or production SMTP/deployment has been verified. No paid service or external message has been sent by implementation tests.

One full regression run observed consumed quota 0 instead of 1 after deleting a supposedly completed test generation. Stronger assertions now require completion and consumed quota before deletion. The next full run passed, and all 9 JobTests passed in three further isolated runs (`jobs-repeat-1.trx` through `jobs-repeat-3.trx`). The cause remains unidentified; do not describe the intermittent failure as fixed.

## 2026-09-08 website continuation

Website now exposes full goal/task title, due date and course/goal association editing. Task creation has its own date/course fields. GPA forms allow term/prior GPA changes and editing subject name, code, credits and grade. Editors retain the version captured when opened and block stale draft submission after a refresh. Added the server-selected next chapter to the dashboard. Website TypeScript and production build passed; browser interaction acceptance for these new forms remains pending.

The preceding mobile work added secure session storage, connected accounts, course/chapter CRUD and PDF selection/upload/text viewing. Mobile TypeScript and Android/iOS Hermes exports passed. Device-level tests and remaining mobile features are still pending. Its dependency audit reported vulnerabilities and needs follow-up; no forced upgrade was applied.
