-- Add scrape cutoff date to sessions
-- The extension stops paginating when all conversations on a page are older than this date.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scrape_cutoff_date date;
