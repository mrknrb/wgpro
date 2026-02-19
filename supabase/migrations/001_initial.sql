-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sessions (one per WG Gesucht ad)
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ad_url text,
  wg_ad_id text,
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Session members
CREATE TABLE session_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  is_admin boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Invite tokens
CREATE TABLE session_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE,
  token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Join requests (pending approvals)
CREATE TABLE join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  invite_token text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Applicants (one per WG Gesucht conversation thread)
CREATE TABLE applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE,
  wg_conversation_id text NOT NULL,
  name text,
  profile_url text,
  photo_url text,
  last_message_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, wg_conversation_id)
);

-- Individual messages within a conversation
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES applicants ON DELETE CASCADE,
  wg_message_id text NOT NULL,
  sender_name text,
  is_from_applicant boolean DEFAULT true,
  content text,
  sent_at timestamptz,
  UNIQUE(applicant_id, wg_message_id)
);

-- Ratings & comments (one row per user per applicant)
CREATE TABLE ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES applicants ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(applicant_id, user_id)
);

-- AI config per session (shared system prompt, editable by all members)
CREATE TABLE ai_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE UNIQUE,
  system_prompt text DEFAULT 'Rate this WG applicant from 1 to 5 and write a short comment based on their messages. Reply ONLY in JSON: {"rating": <1-5>, "comment": "<text>"}',
  updated_at timestamptz DEFAULT now()
);

-- AI rating per applicant
CREATE TABLE ai_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES applicants ON DELETE CASCADE UNIQUE,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,
  generated_at timestamptz DEFAULT now()
);

-- Member availability slots
CREATE TABLE member_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  date date NOT NULL,
  hour integer NOT NULL CHECK (hour BETWEEN 8 AND 22),
  UNIQUE(session_id, user_id, date, hour)
);

-- Booked appointments (applicant into a slot)
CREATE TABLE applicant_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions ON DELETE CASCADE,
  applicant_id uuid REFERENCES applicants ON DELETE CASCADE,
  date date NOT NULL,
  hour integer NOT NULL CHECK (hour BETWEEN 8 AND 22),
  booked_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, date, hour)
);

-- =====================
-- Row Level Security
-- =====================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicant_appointments ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of a session?
CREATE OR REPLACE FUNCTION is_session_member(sid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_members
    WHERE session_id = sid AND user_id = auth.uid()
  );
$$;

-- Helper: is the current user an admin of a session?
CREATE OR REPLACE FUNCTION is_session_admin(sid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_members
    WHERE session_id = sid AND user_id = auth.uid() AND is_admin = true
  );
$$;

-- sessions: members can read, creator can update
CREATE POLICY "members_select_sessions" ON sessions FOR SELECT USING (is_session_member(id));
CREATE POLICY "creator_update_sessions" ON sessions FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "auth_insert_sessions" ON sessions FOR INSERT WITH CHECK (created_by = auth.uid());

-- session_members: members can read their session
CREATE POLICY "members_select_session_members" ON session_members FOR SELECT USING (is_session_member(session_id));
CREATE POLICY "admin_insert_session_members" ON session_members FOR INSERT WITH CHECK (is_session_admin(session_id) OR user_id = auth.uid());
CREATE POLICY "admin_update_session_members" ON session_members FOR UPDATE USING (is_session_admin(session_id));
CREATE POLICY "admin_delete_session_members" ON session_members FOR DELETE USING (is_session_admin(session_id));

-- session_invites: members can read/create
CREATE POLICY "members_select_invites" ON session_invites FOR SELECT USING (is_session_member(session_id));
CREATE POLICY "members_insert_invites" ON session_invites FOR INSERT WITH CHECK (is_session_member(session_id));

-- join_requests: anyone authenticated can insert; admins can read/update
CREATE POLICY "auth_insert_join_requests" ON join_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_select_join_requests" ON join_requests FOR SELECT USING (is_session_admin(session_id) OR user_id = auth.uid());
CREATE POLICY "admin_update_join_requests" ON join_requests FOR UPDATE USING (is_session_admin(session_id));

-- applicants: session members only
CREATE POLICY "members_select_applicants" ON applicants FOR SELECT USING (is_session_member(session_id));
CREATE POLICY "members_insert_applicants" ON applicants FOR INSERT WITH CHECK (is_session_member(session_id));
CREATE POLICY "members_update_applicants" ON applicants FOR UPDATE USING (is_session_member(session_id));

-- messages: session members only (via applicant)
CREATE POLICY "members_select_messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);
CREATE POLICY "members_insert_messages" ON messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);

-- ratings: session members can select; user can only insert/update their own
CREATE POLICY "members_select_ratings" ON ratings FOR SELECT USING (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);
CREATE POLICY "user_insert_ratings" ON ratings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_update_ratings" ON ratings FOR UPDATE USING (user_id = auth.uid());

-- ai_configs: members can read; any member can update
CREATE POLICY "members_select_ai_configs" ON ai_configs FOR SELECT USING (is_session_member(session_id));
CREATE POLICY "members_insert_ai_configs" ON ai_configs FOR INSERT WITH CHECK (is_session_member(session_id));
CREATE POLICY "members_update_ai_configs" ON ai_configs FOR UPDATE USING (is_session_member(session_id));

-- ai_ratings: members can read
CREATE POLICY "members_select_ai_ratings" ON ai_ratings FOR SELECT USING (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);
CREATE POLICY "members_insert_ai_ratings" ON ai_ratings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);
CREATE POLICY "members_update_ai_ratings" ON ai_ratings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM applicants a WHERE a.id = applicant_id AND is_session_member(a.session_id))
);

-- member_availability: members can see all; user can only edit own
CREATE POLICY "members_select_availability" ON member_availability FOR SELECT USING (is_session_member(session_id));
CREATE POLICY "user_insert_availability" ON member_availability FOR INSERT WITH CHECK (user_id = auth.uid() AND is_session_member(session_id));
CREATE POLICY "user_delete_availability" ON member_availability FOR DELETE USING (user_id = auth.uid());

-- applicant_appointments: members can read/write
CREATE POLICY "members_select_appointments" ON applicant_appointments FOR SELECT USING (is_session_member(session_id));
CREATE POLICY "members_insert_appointments" ON applicant_appointments FOR INSERT WITH CHECK (is_session_member(session_id));
CREATE POLICY "members_update_appointments" ON applicant_appointments FOR UPDATE USING (is_session_member(session_id));
CREATE POLICY "members_delete_appointments" ON applicant_appointments FOR DELETE USING (is_session_member(session_id));
