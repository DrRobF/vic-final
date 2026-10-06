# Ask VIC Lesson Designer

Route: `/lessonplan`; official-source directory: `/lessonplan/standards`.

## First release

- Florida B.E.S.T. and Pennsylvania PA Core: K–8 reading/ELA and mathematics. Reading/ELA includes the ELA writing, vocabulary, and communication strands.
- 1,086 sourced entries. Standards API filters by state, grade, and subject; search by code or wording in the browser. Select up to three standards. Each entry has its official PDF URL, page, and source-check date.
- Any state, grade/course, and subject through teacher-pasted standard text. Teacher-provided standards are never inserted into the shared catalogue automatically.
- Lesson length, topic, materials, interests, and 1–5 described differentiation groups.
- 2–16 user-defined section headings in order, optional format instructions, a default template, and an explicit save-format action.
- Editable draft, standard-to-objective/activity/assessment mapping, per-section and whole-plan copying, text and real DOCX downloads, print/PDF, and revision requests.
- Latest draft saved per signed-in user in localStorage. Format saved locally in this browser. No cross-device/cloud plan history is promised.
- State requests prepare a mailto draft. The teacher sends it in their email app; the site does not store or auto-send requests. Four direct official state sources and the national NCES directory are linked.

## Auth and provider

Generation/export use existing Supabase Auth and require a server-verified teacher/principal profile linked by `auth_user_id`. Student/unapproved/anonymous accounts cannot call the AI endpoint. No schema migration or entitlement change is required. Existing student/AP authorization helpers are unchanged.

Existing environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.

Provider: existing `gpt-4.1-mini` via Responses API, strict JSON schema, 6,500 output-token budget, 50-second fetch timeout, provider storage disabled. Output is revalidated for section order and coverage of selected standard codes. Requests use a warm-instance burst cap (10/user/10 minutes), not a global persistent quota. Before wider commercial release, add persistent usage/entitlement accounting and school-specific evaluation.

No student identifying data is needed; the form asks for general group descriptions. Server logs do not print lesson content, account details, tokens, or provider response bodies.

## Standards maintenance

Sources were reached through current official Florida DOE and Pennsylvania SAS download pages, checked October 4, 2026. Florida parsing uses PDF reading order for math; Pennsylvania uses table cells to keep grade columns separate. Assessment-anchor codes are excluded from standard wording. Benchmark clarifications and mathematical-practice standards are outside this first selectable content catalogue. No claim is made that the catalogue includes every possible course/pathway or supplemental standard.

Rebuild: download the five PDFs to a source directory using the URLs in `scripts/import-lesson-standards.py`, then run `python scripts/import-lesson-standards.py <directory>` with pdfplumber and pdftotext installed. Review counts, changed wording, page-spanning text, and sample entries against the originals before publication. The UI tells teachers to confirm the version required by their school.

## Validation

Run `npm test` and `npm run build` with the existing public Supabase build variables. Tests include catalogue coverage, trusted-source resolution, forged/mismatched IDs, custom standards, heading/group validation, output/standard alignment, auth rejection before provider calls, provider failures, burst limits, and real DOCX creation. Provider tests use controlled replies; a signed-in live generation/export check is separately required to confirm production provider access.


## Teacher planning update — October 5, 2026
- New or refreshed/converted lesson; paste or import DOCX, readable PDF, TXT, or Markdown. Authenticated imports use plain text only, up to 3 MB, 30 PDF pages, and 30,000 extracted characters; original files are not stored. Scanned PDFs require pasted text.
- Single lesson or unit of 1–10 sessions, 10–180 minutes per session. Approach and creative task are optional, with 1–5 measurable objectives (default two).
- School headings remain authoritative, including existing saved formats. Structured standards, objectives with activity/evidence, session sequences, and change summaries accompany the requested sections in browser, text, print, and Word output. Legacy drafts remain exportable.
- Curriculum audit, shared lesson storage, school/district accounts, and coverage tracking are future work, not part of this release.


## Complete teaching kit — October 5, 2026
- New drafts require complete shared text/stimulus, worked teacher model, discussion guide, student task/handouts, actual differentiation scaffolds, and exit ticket with answers/success criteria. The optional worksheet remains additional practice.
- Socratic seminars request 6–8 sequenced questions with probes, possible evidence and participation norms. Pacing reserves revision time when revision is an objective; creative choices require an actual product or challenge.
- Browser, print, text and Word use one presentation of each section. Copy/Edit operate on that presentation; persisted edits flow into worksheet generation and invalidate the old worksheet. Official standards remain read-only.
- Existing saved drafts still export; regenerate/revise them to receive the required teaching kit. Content quality remains subject to teacher review.

## PDF deployment packaging fix — October 5, 2026
PDF.js loads native canvas through a runtime createRequire call, which was absent from Next's serverless file trace. Explicitly include canvas packages and native bindings with PDF dependencies. Load the PDF reader only inside PDF extraction so an initialization failure cannot crash other imports or the route before authorization. The UI handles HTML/platform error responses with a useful upload message.

## Existing lesson workflow — October 5, 2026
Refresh/convert now shows the source lesson and requested changes first. Metadata and known standard codes are read from the original, retaining exact catalogue wording when matched. Missing official standards remain unverified teacher-provided original learning goals. Unknown grade/subject remain “Same as original” for the generator rather than silently using new-lesson defaults. Only an absent overall duration requires a small follow-up field. Optional detail overrides expand the full form. New-lesson workflow is unchanged. Common source headings, objective count and numbered unit sessions are retained.

## Full-width editing and section proposals (October 6)

After generating, `/lessonplan?view=lesson` displays the lesson at full width. The teacher can return to setup or open the saved lesson in a separate tab. The title and all non-official sections can be edited before copying, printing or downloading. Official standard wording remains protected.

Each editable section has **Ask VIC to rewrite**. `/api/lessonplan/section` authenticates the educator, validates the selected section, and returns only a proposal. Teacher edits elsewhere are included as context. The teacher may edit, accept, or cancel the proposal. Applying it changes only that section's display edit; other lesson content is untouched. A stale preview is refused if the lesson has changed. Worksheets are invalidated after an applied edit; standards alignment and other repeated references are not regenerated automatically, so the teacher reviews dependencies. Text and Word exports use the same canonical sections, including edited alignment/review.

## Public email access via the existing Resend sender

`/lessonplan/access` implements passwordless email sign-in and an explicit adult-educator declaration and newsletter checkbox. `/api/lessonplan/email` generates a one-time Supabase verification token server-side and sends it through the existing `RESEND_API_KEY` and `REPORTS_FROM_EMAIL` configuration. The token is in a URL fragment, not an API response or site request query. No Supabase SMTP or redirect allowlist change is needed because the app verifies the token hash directly through `verifyOtp`. Missing delivery credentials or `LESSON_PUBLIC_SIGNUP_ENABLED=false` disable signup. With the existing sender and auth credentials configured, free signup is enabled.

Email consent is saved only after `getUser` verifies the email and the teacher confirms the consent wording and adult-educator declaration. Public members receive no school user profile. Email preferences permit unsubscribing while retaining lesson access. No newsletters are automatically sent by this release.

Rob approved publishing and the school-access changes October 6. The cloud migration `protect_school_accounts_before_public_lesson_signup` removes public profile insertion and anonymous school lesson/assignment reads while preserving authenticated approved students' lesson access. SQL is mirrored in `sql/proposed_public_signup_school_protection.sql` (the original proposal filename is retained).

Applied migration `free_lesson_memberships_and_usage_guard` is mirrored in `sql/free_lesson_access.sql`. Both tables have RLS and no anon/authenticated table access. The invoker-only `claim_lesson_request` RPC is service-role-only. It allows 10 generation requests per user per 10 minutes and a configurable global daily budget, default 500. This is abuse and cost protection, not a lifetime trial allowance. Set `LESSON_DAILY_REQUEST_BUDGET` based on measured costs. Lesson, worksheet and section generation share the guard; downloads and editing do not consume requests.

Applied migration `guard_public_lesson_signin_email_delivery` is mirrored in `sql/lesson_signup_email_guard.sql`. It limits signin email requests to 3 per email and 10 per IP per 10 minutes, plus 75 globally per day initially to protect the existing sender's quota. Hashed email/IP buckets are stored; tokens are not logged. Revisit the global email limit as real demand grows and after verifying the Resend account's quota.

Validation: unit and mocked-handler tests, real database rollback checks, production builds, and deployment status/HTTP checks. Browser interaction testing could not run because the browser download failed. Live AI quality and actual inbox delivery must be checked by an educator signing up with their own email. A provider-accepted send does not itself prove inbox arrival.
