-- Personalize existing editable drafts that still contain a generic signature placeholder.
update public.parent_letter_drafts as d
set body = regexp_replace(d.body, '\[(your name|teacher''s name)\]', trim(u.name), 'gi'),
    updated_at = now()
from public.users as u
where u.auth_user_id = d.teacher_auth_id
  and u.role = 'teacher'
  and nullif(trim(u.name), '') is not null
  and d.status = 'draft'
  and d.body ~* '\[(your name|teacher''s name)\]';
