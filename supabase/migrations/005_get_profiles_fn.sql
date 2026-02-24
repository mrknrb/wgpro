-- Helper to fetch usernames for a list of user IDs.
-- SECURITY DEFINER bypasses RLS, same pattern as is_session_member().
CREATE OR REPLACE FUNCTION get_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, username text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.user_id, p.username FROM profiles p WHERE p.user_id = ANY(p_user_ids);
$$;
