-- User profiles (username set at registration)
CREATE TABLE profiles (
  user_id  uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read profiles (needed for member lists)
CREATE POLICY "authenticated_select_profiles" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
-- Users can only insert/update their own profile
CREATE POLICY "user_insert_profile" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_update_profile" ON profiles FOR UPDATE USING (user_id = auth.uid());

-- Auto-create profile from raw_user_meta_data when a user signs up.
-- Frontend passes username via supabase.auth.signUp({ options: { data: { username } } })
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (user_id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
