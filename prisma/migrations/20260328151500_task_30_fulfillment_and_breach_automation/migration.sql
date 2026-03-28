ALTER TABLE privacy_requests
ADD COLUMN processed_by_user_id TEXT NULL,
ADD COLUMN resolution JSONB NULL;

ALTER TABLE privacy_requests
ADD CONSTRAINT privacy_requests_processed_by_user_id_fkey
FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX privacy_requests_processed_by_user_id_idx
ON privacy_requests(processed_by_user_id);

CREATE TABLE privacy_breach_incidents (
  id TEXT PRIMARY KEY,
  reported_by_user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_user_ids TEXT[] NOT NULL,
  detected_at TIMESTAMP(3) NOT NULL,
  occurred_at TIMESTAMP(3) NULL,
  pdpa_office_notified_at TIMESTAMP(3) NULL,
  data_subjects_notified_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT privacy_breach_incidents_reported_by_user_id_fkey
    FOREIGN KEY (reported_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX privacy_breach_incidents_reported_by_user_id_created_at_idx
ON privacy_breach_incidents(reported_by_user_id, created_at);

CREATE INDEX privacy_breach_incidents_created_at_idx
ON privacy_breach_incidents(created_at);
