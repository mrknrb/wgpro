-- Extend status check to include AfterCasting and Accepted
ALTER TABLE applicants
  DROP CONSTRAINT applicants_status_check;

ALTER TABLE applicants
  ADD CONSTRAINT applicants_status_check
  CHECK (status IN ('Declined', 'Applied', 'Appointment', 'Casting', 'AfterCasting', 'Accepted'));
