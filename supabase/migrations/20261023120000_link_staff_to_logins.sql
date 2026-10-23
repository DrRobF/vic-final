-- Join the two lists AskVic keeps of the same people.
--
-- ap_staff is the attendance list: who checks in, paid days, absences. users/classes is the
-- teaching list: who owns classes and lesson plans. They meet only at ap_staff.auth_user_id,
-- and for most of Saint Peter's staff that column was never filled in -- so an absence could
-- not be walked through to the classes it leaves uncovered or the lessons planned for them.
-- That walk is what "give the sub today's lessons from whoever is out" needs.
--
-- Matches on email only, and only where both sides already agree. A staff record with no
-- email, or a login nobody on the board shares an address with, is left alone: guessing at
-- identity from a name would merge two people who happen to share one, and the whole point
-- of this column is that it asserts "these two records are the same human".
--
-- Grants nothing new. School dashboard access lives in ap_memberships, not here; this only
-- ties the records together (and lets that person ask for a day off). Reversible by setting
-- auth_user_id back to null.
with pairs as (
 select s.id as staff_id, u.auth_user_id
 from public.ap_staff s
 join public.users u on lower(u.email) = lower(s.email)
 where s.active
   and s.auth_user_id is null
   and u.auth_user_id is not null
   -- One login per board record: never point two staff rows at the same person.
   and not exists (select 1 from public.ap_staff x where x.auth_user_id = u.auth_user_id)
)
update public.ap_staff s
set auth_user_id = p.auth_user_id,
    joined_at = coalesce(s.joined_at, now())
from pairs p
where s.id = p.staff_id;
