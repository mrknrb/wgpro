-- Harden the handle_new_user trigger:
-- - Use NULLIF so empty-string username falls back to email prefix
-- - ON CONFLICT (user_id) DO NOTHING prevents duplicate-profile crash on re-signup
-- - ON CONFLICT (username) appended with short id suffix to avoid unique violation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username text;
BEGIN
  v_username := NULLIF(trim(NEW.raw_user_meta_data->>'username'), '');
  IF v_username IS NULL THEN
    v_username := split_part(NEW.email, '@', 1);
  END IF;

  -- If that username is already taken, append 4 chars of the user id
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := v_username || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
