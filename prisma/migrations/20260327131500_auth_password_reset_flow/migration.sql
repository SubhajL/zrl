CREATE TABLE "password_reset_requests" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "token_hash" TEXT,
  "expires_at" TIMESTAMPTZ,
  "used_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "password_reset_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_reset_requests_token_hash_key"
  ON "password_reset_requests" ("token_hash");

CREATE INDEX "password_reset_requests_email_created_at_idx"
  ON "password_reset_requests" ("email", "created_at");
