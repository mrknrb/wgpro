ALTER TABLE applicant_appointments ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
