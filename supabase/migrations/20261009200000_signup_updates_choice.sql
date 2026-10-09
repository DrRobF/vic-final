-- Email updates are a separate Yes/No choice at signup; the pending record carries the choice until email verification.
alter table public.lesson_signup_consents add column if not exists newsletter_consent boolean not null default true;
