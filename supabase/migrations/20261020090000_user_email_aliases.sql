-- Extra email addresses that reach the same account.
--
-- Staff signed up with personal addresses and the school has since issued
-- @saintpetersacademy.org ones. Nobody should lose their classes, lessons or week
-- because their address changed, so an account can answer to more than one.
--
-- Safety: an alias on its own grants nothing. Logging in still means receiving a
-- one-time code AT that address, so only someone who controls the mailbox can use it.
--
-- `retired_at` is the off-ramp: when a teacher leaves, the school mailbox is shut off
-- but a personal one never is, so the old address must be retirable without deleting
-- the history of it having been there.
create table public.user_email_aliases (
 id bigint generated always as identity primary key,
 user_id bigint not null references public.users(id) on delete cascade,
 email text not null,
 added_by bigint references public.users(id) on delete set null,
 source text not null default 'admin' check (source in ('admin','self')),
 created_at timestamptz not null default now(),
 retired_at timestamptz
);

-- One account per address, across both this table and users.email.
create unique index user_email_aliases_email on public.user_email_aliases(lower(email));
create index user_email_aliases_user on public.user_email_aliases(user_id);

-- Addresses are always stored lowercase, so lookups never miss on capitalisation.
alter table public.user_email_aliases add constraint user_email_aliases_lowercase check (email = lower(email));
alter table public.user_email_aliases add constraint user_email_aliases_shape check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

alter table public.user_email_aliases enable row level security;
revoke all on public.user_email_aliases from public,anon,authenticated;
grant select,insert,update,delete on public.user_email_aliases to service_role;
