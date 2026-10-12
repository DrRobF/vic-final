-- rls_auto_enable runs as an event trigger that turns on row level security for every new public table.
-- It never needs to be called through the API, so signed-out and signed-in users cannot run it directly.
-- Applied to production October 12, 2026. The event trigger keeps working.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
