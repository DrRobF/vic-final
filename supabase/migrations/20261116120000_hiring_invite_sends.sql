-- A record of every hiring email this system sends, and what the mail provider later said happened
-- to it.
--
-- Why this table exists: the first real batch of invitations went out and one candidate in eight
-- came back. Nobody could answer the only question that mattered -- did the other seven ever
-- receive the email? -- because the send result was shown on screen once and then forgotten. A
-- school deciding whether to chase candidates or re-advertise a position should not have to guess,
-- and should not have to log into a mail provider's dashboard to find out.
--
-- Two different facts are kept apart on purpose:
--   outcome   what happened when we handed the message to the provider. 'sent' means accepted for
--             delivery -- NOT that it reached anybody.
--   delivery  what the provider told us afterwards, over its webhook: delivered, bounced,
--             complained. Null means we have not heard back, which is not the same as failure.
-- Collapsing those two into one column is how a bounced address comes to be read as a candidate
-- who ignored you.
create table if not exists public.ap_hiring_invite_sends (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 candidate_id uuid not null references public.ap_hiring_candidates(id) on delete cascade,
 -- 'invite' is the first one; 'reminder' is every later attempt at the same candidate.
 kind text not null default 'invite' check (kind in ('invite', 'reminder')),
 attempt smallint not null default 1,
 to_email text not null,
 subject text,
 outcome text not null check (outcome in ('sent', 'failed', 'not_configured')),
 -- The provider's own id for the message, so a send here can be found in their dashboard without
 -- searching by a candidate's name.
 provider_id text,
 delivery text check (delivery in ('delivered', 'bounced', 'complained', 'delivery_delayed')),
 delivery_detail text,
 delivery_at timestamptz,
 sent_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

create index if not exists ap_hiring_invite_sends_candidate_idx
 on public.ap_hiring_invite_sends (candidate_id, created_at desc);

-- The webhook arrives knowing only the provider's message id, so that lookup has to be fast and
-- must match exactly one row.
create unique index if not exists ap_hiring_invite_sends_provider_idx
 on public.ap_hiring_invite_sends (provider_id) where provider_id is not null;

comment on table public.ap_hiring_invite_sends is
 'Every invitation and reminder email sent to a hiring candidate. outcome = what the provider accepted; delivery = what it reported later.';
comment on column public.ap_hiring_invite_sends.outcome is
 'Accepted by the mail provider, or not. ''sent'' does not mean the candidate received it -- see delivery.';
comment on column public.ap_hiring_invite_sends.delivery is
 'Reported by the provider afterwards. Null means no report yet, which is not a failure.';

alter table public.ap_hiring_invite_sends enable row level security;

-- Deliberately no anon or authenticated policies: every read and write goes through the server
-- with the service role, after it has checked the leader's access to the school. A candidate must
-- never be able to read this table -- it lists every other applicant for the job.
revoke all on public.ap_hiring_invite_sends from public, anon, authenticated;
grant select, insert, update, delete on public.ap_hiring_invite_sends to service_role;

-- How many times we have written to this candidate, kept on the candidate row so the panel list
-- can show it without a join per row.
alter table public.ap_hiring_candidates
 add column if not exists reminders_sent smallint not null default 0,
 add column if not exists last_contact_at timestamptz;

comment on column public.ap_hiring_candidates.reminders_sent is
 'Reminder emails sent after the original invitation. Shown to the panel so nobody is written to twice in a morning.';
