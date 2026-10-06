-- Applied migration: remember_lesson_signup_consent_until_email_verification
create table public.lesson_signup_consents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, consent_text text not null, consent_version text not null,
 consented_at timestamptz not null default now()
);
alter table public.lesson_signup_consents enable row level security;
revoke all on public.lesson_signup_consents from anon,authenticated;
grant all on public.lesson_signup_consents to service_role;
