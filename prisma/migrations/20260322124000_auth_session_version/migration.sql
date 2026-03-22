-- Add session version so logout can invalidate JWTs and refresh tokens.
ALTER TABLE "users"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

