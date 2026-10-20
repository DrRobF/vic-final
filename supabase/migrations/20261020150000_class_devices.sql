-- A classroom computer that children tap their name on.
--
-- Third graders forget passwords daily, so they should not have one: they identify
-- themselves rather than authenticate. The credential is this device, not the child.
--
-- The teacher sets a Chromebook or iPad up once while signed in; the device keeps a
-- random token, and children on it see only their own class and tap a name.
--
-- Why a device token and not the class code: class codes are things like G3M26, which
-- anyone could guess. A token is 32 random bytes, only ever stored as a hash, and can be
-- revoked if a device goes missing.
--
-- The accepted trade-off (agreed with Dr. Furman, 20 Oct 2026): a child on this device
-- could tap a classmate's name. That is about as serious as picking up the wrong
-- worksheet, and it is proportionate for what sits behind it -- VIC conversations and
-- worksheets. If anything more sensitive is ever shown to students, add the picture code
-- on top before shipping it.
create table public.class_devices (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 class_id bigint not null references public.classes(id) on delete cascade,
 label text not null default '',
 token_hash text not null,
 created_by uuid,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz,
 revoked boolean not null default false
);

create unique index class_devices_token on public.class_devices(token_hash);
create index class_devices_class on public.class_devices(class_id) where revoked = false;
create index class_devices_school on public.class_devices(school_id) where revoked = false;

alter table public.class_devices enable row level security;
revoke all on public.class_devices from public,anon,authenticated;
grant select,insert,update,delete on public.class_devices to service_role;
