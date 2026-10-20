-- Saint Peter's staff signed up with personal addresses before the school issued
-- @saintpetersacademy.org ones. These let each person log in with either, reaching the
-- same account. Matched by name, by Dr. Furman, on 20 Oct 2026.
--
-- Safe to seed: an alias grants nothing on its own. Signing in still means receiving a
-- one-time link AT that address, so only whoever reads that mailbox can use it.
insert into public.user_email_aliases (user_id, email, added_by, source)
select v.user_id, v.email, 1, 'admin'
from (values
 (175,'victoria.barattini@saintpetersacademy.org'),
 (89,'magda.rodriguez@saintpetersacademy.org'),
 (87,'karen.green@saintpetersacademy.org'),
 (90,'sandra.morgan@saintpetersacademy.org'),
 (91,'karen.williams@saintpetersacademy.org'),
 (86,'andeen.anderson@saintpetersacademy.org'),
 (177,'william.grimison@saintpetersacademy.org'),
 (178,'shontae.mack@saintpetersacademy.org'),
 (179,'amber.manuael@saintpetersacademy.org'),
 (1,'rob.furman@saintpetersacademy.org')
) as v(user_id, email)
where exists (select 1 from public.users u where u.id = v.user_id)
on conflict do nothing;

-- Still to come, once they have AskVic accounts: Gloria Finch, Dale Dawkins,
-- Ruth Jefferson, Barbara Andrews.
