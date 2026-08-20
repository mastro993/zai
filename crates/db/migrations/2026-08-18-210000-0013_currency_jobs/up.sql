CREATE TABLE currency_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL CHECK (
        job_type IN ('setup', 'addCurrency', 'changeDefault', 'importPreview')
    ),
    status TEXT NOT NULL CHECK (
        status IN ('running', 'succeeded', 'failed', 'cancelled')
    ),
    currency_code TEXT CHECK (
        currency_code IS NULL
        OR (length(currency_code) = 3 AND currency_code = upper(currency_code))
    ),
    stage_current INTEGER NOT NULL CHECK (stage_current >= 0),
    stage_total INTEGER NOT NULL CHECK (stage_total >= 0),
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX currency_jobs_one_running
ON currency_jobs (status)
WHERE status = 'running';
