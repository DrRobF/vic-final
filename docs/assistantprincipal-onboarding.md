# Assistant Principal: first build

Route: `/assistantprincipal` in Ask VIC. This is the first working slice: a protected, school-scoped workspace for staff cards, configurable recurring commitments, manually recorded evidence, school source links, and a private AI weekly brief that a principal can edit and approve. Approval records the review; it does not send anything.

## Deployment steps

1. Run `sql/assistant_principal.sql` in the existing AskVic Supabase project. Check that `public.users.role` can hold `principal`; if the deployed database has a role check constraint, extend that constraint through a reviewed migration before assigning the role.
2. Create or identify the buyer's Supabase Auth account and matching `public.users` row. Set the verified profile's `role` to `principal` and its `auth_user_id` to the Auth user's ID. Only an authorized school administrator should grant this role. Existing teacher/student accounts are not automatically promoted. Provision an `ap_entitlements` row for that Auth user (`trial` or `active`, school limit, optional expiry) after confirming the pilot/license. No public visitor can grant their own entitlement.
3. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` configured server-side as appropriate. The service role and OpenAI key never belong in client-side variables.
4. The principal signs in, creates a school workspace, adds staff and commitments, then saves reference links for attendance, lesson plans, grades, walkthroughs, and absences. Every new school starts empty. Do not paste student data, credentials, or access tokens into setup.
5. Confirm a second principal account cannot read another school's dashboard by changing `schoolId` in an API request. The API verifies membership on every request, and new tables have no direct browser grants.

## What a school supplies

- School name and time zone.
- Staff names, roles, and optional email addresses.
- Commitments: title, roles, daily/weekly cadence, weekday, and due time.
- Optional HTTPS links to existing data sources. Saving a link does not grant access or start syncing. An import needs school authorization, field mapping, consent/retention decisions, and a separate tested connector.
- Friday or Monday non-confidential notes for a weekly brief. The school leader edits and approves the draft.

Saint Peter's Academy is an early test school, not a product default. Do not put its roster, student grades, kiosk codes, source URLs, or parent contacts in repository code or seed data. Its walkthrough response has a distinct administrative-notes field that must not be included in teacher-facing PD. Its attendance `Code` column must never be exposed on a staff card. Teacher-specific gradebook, automatic form triggers, audio meetings, reminders, and phone delivery are later slices after role, data access, and approval gates are verified.

## Packaging for licenses

The same application serves multiple `ap_schools`. Each new principal creates a clean school workspace within their entitlement's school limit; membership and school IDs scope every read/write. Future onboarding can offer a generated template sheet or a connector to a school's existing system. Billing and automatic account provisioning are not in this slice. Until those exist, Ask VIC grants principal access and school entitlement manually after a license or pilot is approved.
