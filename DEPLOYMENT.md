# AdvisorOS — review build

This update is based on the uploaded AdvisorOS-main.zip, identified by archive commit aaa2ef15d68cb03260d4c2c1ef9546da589801d1. This document describes the review branch. Production deployment and hosted database migrations have not been verified. Apply it to a separate branch and use a staging Supabase project first. The upload did not include your database schema, row-level security policies, or deployment credentials.

## What changed

- Shared sans-serif typography, cooler neutral surfaces, restrained teal accents, consistent cards and spacing, visible keyboard focus, and reduced-motion support. Fonts use the local system stack rather than a Google Fonts download.
- Grouped sidebar navigation, a clear New meeting action, a mobile navigation dialog, and more usable account controls. Custom logo/brand colours remain on the brand and account marks.
- Redesigned dashboard with linked metrics, readable processing states, recent meetings and linked review suggestions. Independent queries run in parallel and totals use exact database counts. The old wealth-only “Clients needing info” metric is replaced by a client count; “Meetings recorded” explicitly covers the last 24 hours rather than claiming scheduled meetings.
- Sign-in labels, autocomplete, connection-error handling and clearer copy. Shared layout changes also apply to the existing screens; individual secondary screens have not all been redesigned.
- Transcription completion and document intake start analysis on the server using Next.js `after`. Leaving the meeting page no longer stops analysis. Browser refresh only checks progress.
- Database processing tokens and leases prevent duplicate active work and obsolete workers saving over a later attempt. Retries reuse an existing transcript. Stalled analysis becomes eligible for manual retry after six minutes; transcription after two hours.
- Transcript and core analysis replacement happen in database transactions. A failed insert rolls back the delete. Manual internal notes are preserved.
- Bounded AI request timeouts; larger output budgets; detection of truncated summaries and extractions; validation of the core response before saving. Existing extraction/summary parallelism is retained. Additional enrichment is awaited after the core results are saved, with an incomplete-enrichment notice if it fails.
- Authentication and ownership checks added to processing, enrichment, client/meeting deletion, document generation and contact analysis endpoints that previously lacked them. Document extraction now requires authentication and accepts DOCX files under 4 MB.
- Retired `/api/debug-env`: it now returns 404 and never returns credentials. Auth proxy now validates the user and preserves refreshed cookie options.

## Required before deployment

1. Rotate the AssemblyAI API key. The old `/api/debug-env` endpoint returned the full key without authentication, and old callback URLs contained the key. Removing the endpoint does not invalidate an exposed credential. Check provider usage and remove the old deployment from public access if it remains reachable.
2. Back up the database. In staging, run both migration files in `supabase/migrations/` in filename order (202609080001, then 202609090001) through the Supabase SQL editor or your existing migration workflow. Together they add processing metadata, an enrichment status, and three service-role-only functions. The migration assumes UUID meeting IDs, text-compatible statuses, and JSON-compatible transcript/analysis columns; confirm against your actual schema. It was tested with a representative local PostgreSQL schema, not your hosted database.
3. In Vercel, configure the existing Supabase URL, anon key, service-role key, Anthropic key and the newly rotated AssemblyAI key. Set `ASSEMBLYAI_WEBHOOK_SECRET` to an independent random secret of at least 32 characters. Keep it server-only. Set `NEXT_PUBLIC_APP_URL` to the exact HTTPS origin receiving callbacks. Preserve existing Resend/Azure settings for their respective features. Do not paste secrets into source control or chat.
4. Confirm that the selected Vercel function configuration supports the routes' 300-second maximum duration. Core AI calls use a 110-second timeout with no SDK retries; optional enrichments use 100 seconds. Provider/database/network overhead also consumes the invocation budget. This is bounded background work, not a durable queue: platform termination can still require a manual retry.
5. Deploy the review branch against staging. Callback requests must be able to reach `/api/transcript-webhook`; deployment protection must not block that route. The callback verifies a per-attempt signature and the saved provider transcript ID.
6. Drain old transcription jobs before switching. Old callbacks using `secret=<API key>` are intentionally rejected. Retry older stalled meetings through the meeting page after deployment. Do not restore the insecure callback format.
7. Complete the staging checks below before switching production traffic.

## Staging acceptance checks

- Sign in and sign out; refresh an expired session; verify a signed-out visitor is redirected from the dashboard.
- With two adviser accounts, verify that neither can read, process, generate documents for, or delete the other's client/meeting data. Inspect Supabase row-level security for all browser-accessible tables and storage; this archive does not contain the policies.
- Upload a DOCX transcript and an audio recording. Leave the meeting page immediately. Return later and confirm the transcript, complete summary, structured facts and review suggestions appear.
- Submit the same meeting twice and deliver the same callback twice. Confirm one active analysis and one current transcript/core fact record.
- Simulate provider failure, malformed/truncated model output and a failed database insert. Verify honest failure feedback and preservation of earlier records. Retry a failed transcript meeting and confirm it does not submit another audio transcription.
- Test 5-, 30- and 60-minute recordings. Measure upload, provider transcription, extraction and enrichment separately. `meeting_analysis` logs record elapsed analysis milliseconds and outcome without logging transcript contents. No live speed improvement has been measured in this workspace.
- Review on a phone and desktop: navigation open/close, Escape and focus return, long client names, empty/error states, record/upload, playback, transcript review, tasks, search and account settings. Browser-based visual QA was blocked in this environment.
- Validate record deletion with your full foreign-key schema. The older deletion workflows still comprise multiple writes; this update adds access controls but does not make those older workflows transactional.
- Verify language flags against known speaker identities before treating them as adviser-specific conclusions. Secondary enrichment still uses the original multi-write storage design; it needs further fault/concurrency testing. Do not infer that absence of a flag establishes compliance.

## Local verification

Use Node.js 20.9+ and the supplied lockfile:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The build requires configured environment variables because existing modules instantiate API clients during module loading. Placeholder keys were used only for compilation checks here; they cannot validate live integrations.

Verification on 9 September 2026: production build passed with placeholder credentials; all five test groups passed with a local server, including 12 unauthenticated endpoint checks, the retired debug route and forged callbacks. Targeted lint passed.

`npm test` runs local PostgreSQL migration/lease/rollback tests and model-output/signature tests. HTTP integration tests are opt-in: start a local development server, then run:

```sh
TEST_BASE_URL=http://127.0.0.1:3000 npm test
```

HTTP tests explicitly reject non-local hosts and send only anonymous test requests. They do not validate an authenticated production account.

Repository-wide ESLint has an existing backlog: the uploaded baseline reported 278 errors and 48 warnings. The main newly written processing/UI files passed their targeted ESLint check; do not treat a passing build as a clean lint report. Remaining issues and all staging checks should be resolved before declaring the entire product launch-ready.

## Installing this review build

Create a branch from the current repository. Compare its current files with the uploaded archive before replacing anything: later changes made in GitHub or Claude are not included here. Copy the updated source onto that branch, preserve your private environment configuration, apply the migration to staging, and open a pull request. Do not merge directly into the production branch without staging validation.

For rollback, prefer restoring a known secure deployment and leave the additive database columns/functions in place. Do not restore the old credential-disclosure endpoint. Database backups are the recovery path for data problems; code rollback alone does not reverse data changes.


## Results-loading update — 9 September 2026

The meeting detail page now fetches independent result panels in parallel. A small authenticated status endpoint is polled every two seconds while work is pending; the full page refreshes only when a processing stage changes or an attempt becomes stale. Polling pauses while the tab is hidden and reports connection failures. Core results appear before optional enrichment finishes, and polling continues until those additional insights are ready or the attempt times out. Approved meetings retain their analysis panels. Uploaded document transcripts display full text even without speaker-labelled utterances. Mobile tabs sit below the navigation header and scroll horizontally.

Apply the second migration as well as the first before deploying this version. This update improves the delay between saved results and their appearance in the UI; it does not establish a measured reduction in provider inference time. Real-recording latency and visual acceptance checks remain required.


## Integration with GitHub main

Compared against main at ff8cd1663212c5d285b2921961c2b06fbd1e4831. Preserves its removal of automatic stage/speaker timelines to reduce output size. Optional historical timelines remain supported. Restores the complete dependency lockfile together with the new test dependencies. The previously uploaded deployment notes alone did not install the app changes.

## Hosted database verification — 9 September 2026

The connected AdvisorOS project was inspected: UUID IDs, text statuses and JSONB payloads match the processing migrations. Both processing migrations have now been applied and their columns and service-role-only function permissions verified. No existing meeting or transcript content was rewritten by these migrations.

Inspection also found row-level security disabled on `transcripts` and `super_admins`, with anonymous table privileges. Added and applied `202609090002_private_transcripts_and_admins.sql`: authenticated users can read transcripts for their own meetings; admin membership can only be read by the matching authenticated email; browser writes to these two tables are denied. Server service-role operations retain access. Local PostgreSQL tests cover anonymous denial, adviser isolation, prevention of self-assigned admin membership, admin self-checks and service-role access. Supabase's security advisor no longer reports either RLS error. Its leaked-password-protection warning remains; enable that in Auth settings where supported. This is not a full audit of every existing policy.

When installing on another database, apply all three migrations in filename order after schema verification. On this connected project, use migration history to avoid reapplying the policy migration.

Code is on `codex/advisoros-polish-processing`, pull request #1. Both linked Vercel projects initially reported failed preview deployments; build logs and runtime configuration remain to be checked. No production merge, provider key rotation, authenticated preview test or live latency benchmark has been completed.

## Missing Resend key build fix

The supplied Vercel log identified module-level Resend construction in `/api/admin/create-adviser` as the build failure. Resend is now instantiated only during an authenticated, authorised invitation request. Missing `RESEND_API_KEY` returns HTTP 503 before creating an account; provider-returned send errors are reported accurately. Add a valid Resend key to the relevant Vercel environment to enable invitations. This email configuration no longer blocks deployment of meeting features.
