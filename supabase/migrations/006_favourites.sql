-- Favourites: per-user per-applicant, visible to all session members
CREATE TABLE favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES applicants ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(applicant_id, user_id)
);

ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;

-- All session members can see all favourites
CREATE POLICY "members_select_favourites" ON favourites FOR SELECT USING (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);

-- Users can only manage their own favourites
CREATE POLICY "user_insert_favourites" ON favourites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_delete_favourites" ON favourites FOR DELETE USING (user_id = auth.uid());

-- Make ratings private: users can only see their own rating & comment
DROP POLICY IF EXISTS "members_select_ratings" ON ratings;
CREATE POLICY "user_select_own_ratings" ON ratings FOR SELECT USING (user_id = auth.uid());
