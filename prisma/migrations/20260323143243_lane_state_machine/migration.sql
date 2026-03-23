ALTER TABLE lanes
ADD COLUMN status_changed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE lanes
SET status_changed_at = COALESCE(updated_at, created_at);
