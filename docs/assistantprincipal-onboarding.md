# Assistant Principal: first build

Route: `/assistantprincipal` in Ask VIC. This is the first working slice: a protected, school-scoped workspace for editable staff cards, configurable recurring commitments, manually recorded evidence, school source links, and a private AI weekly brief that a principal can edit and approve. Approval records the review; it does not send anything.

## Deployment steps

1. Run `sql/assistant_principal.sql` in the existing AskVic Supabase project. Check that `public.users.role` can hold `principal`; if the deployed database has a role check constraint, extend that constraint through a reviewed migration before assigning the role.
2. Create or identify the buyer's Supabase Auth account and matching `public.users` row. Its `auth_user_id` must match the Auth user's ID. An existing teacher profile may keep its teacher role and use both portals. A dedicated school leader profile may use `principal` (check the deployed `users.role` constraint first). Provision an `ap_entitlements` row for the Auth user (`trial` or `active`, school limit, optional expiry) after confirming the pilot/license. Only an authorized school administrator grants entitlements; no public visitor can grant their own.
3. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` configured server-side as appropriate. The service role and OpenAI key never belong in client-side variables.
4. The principal signs in, creates a school workspace, then downloads the separate staff and commitments CSV sheets from School setup. Each can be pasted in bulk, previewed, and imported independently. Repeated rows are skipped. Single-entry forms remain available. Individual staff and commitments can be edited after import. The principal then saves reference links for attendance, lesson plans, grades, walkthroughs, and absences and selects the matching link for each commitment. Every new school starts empty. Do not paste student data, credentials, or access tokens into setup.
5. Confirm a second principal account cannot read another school's dashboard by changing `schoolId` in an API request. The API verifies membership on every request, and new tables have no direct browser grants.

## What a school supplies

- School name and time zone.
- Staff names, roles, and optional email addresses.
- Commitments: title, roles, daily/weekly cadence, weekday, and due time.
- Staff CSV columns: `Staff name,Role,Grade or assignment (optional),Email (optional)`. Roles: teacher, office, support, leader, other. Grade or assignment is separate from role; an existing staff member can gain an assignment/email on reimport.
- Commitments CSV columns: `Commitment,Applies to,Repeats,Due day,Due time`. Use Teacher or All staff, Daily/Weekly/Monthly, a weekday for weekly rules, a date such as First day of the Month for monthly rules, and a time such as 10:00 AM. Leave the day blank for daily rules. Example rows in the templates are ignored until replaced. Each upload previews row errors and imports atomically; duplicate commitments are skipped.
- Optional HTTPS links to existing data sources. One source can support several commitments; for example, the attendance sheet can be selected for separate daily check-in and check-out rules. Several sources may share a type. Saving or selecting a link does not grant access or start syncing. The dashboard calls absent evidence "unverified," not proof that a staff member failed to submit. Automatic verification needs school authorization, source access, field mapping, a reliable staff identifier, time-zone/date logic, and a separate tested connector. A generic URL cannot provide those checks.
- Friday or Monday non-confidential notes for a weekly brief. The school leader edits and approves the draft.

Saint Peter's Academy is an early test school, not a product default. Do not put its roster, student grades, kiosk codes, source URLs, or parent contacts in repository code or seed data. Its walkthrough response has a distinct administrative-notes field that must not be included in teacher-facing PD. Its attendance `Code` column must never be exposed on a staff card. Teacher-specific gradebook, automatic form triggers, audio meetings, reminders, and phone delivery are later slices after role, data access, and approval gates are verified.

## Packaging for licenses

The same application serves multiple `ap_schools`. Each entitled school leader creates a clean school workspace within their school limit; membership and school IDs scope every read/write. Future onboarding can offer a generated template sheet or a connector to a school's existing system. Billing and automatic account provisioning are not in this slice. Until those exist, Ask VIC grants school entitlements manually after a license or pilot is approved.
