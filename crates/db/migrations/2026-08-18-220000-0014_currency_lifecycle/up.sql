ALTER TABLE currency_settings
ADD COLUMN provider_disclosure_accepted_at TIMESTAMP;

ALTER TABLE currency_jobs
ADD COLUMN generation_id TEXT;

ALTER TABLE currency_jobs
ADD COLUMN error_details TEXT;
