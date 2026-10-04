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
