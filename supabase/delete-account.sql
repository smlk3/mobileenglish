-- ============================================================
-- LinguaLearn — account deletion (Google Play policy requirement)
-- Run this once in the Supabase SQL Editor.
--
-- Lets a signed-in user permanently delete their own account + data.
-- SECURITY DEFINER so it can remove the auth.users row; it only ever
-- touches the caller's own rows (auth.uid()).
-- ============================================================

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Remove the user's synced data (also covered by ON DELETE CASCADE,
  -- deleted explicitly here so it works regardless of FK setup).
  delete from public.cards          where user_id = uid;
  delete from public.decks          where user_id = uid;
  delete from public.study_sessions where user_id = uid;

  -- Remove the auth account itself.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_account() to authenticated;
