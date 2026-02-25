-- Add status to applicants
ALTER TABLE applicants
  ADD COLUMN status text NOT NULL DEFAULT 'Applied'
  CHECK (status IN ('Declined', 'Applied', 'Appointment', 'Casting'));
