-- Fix profiles SELECT policy: usernames are not sensitive,
-- allow all reads so the server-side queries always work.
DROP POLICY IF EXISTS "authenticated_select_profiles" ON profiles;
CREATE POLICY "anyone_select_profiles" ON profiles FOR SELECT USING (true);

-- Backfill existing users that have no profile row yet.
INSERT INTO profiles (user_id, username)
SELECT
  id,
  split_part(email, '@', 1) || '_' || substr(id::text, 1, 4)
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
