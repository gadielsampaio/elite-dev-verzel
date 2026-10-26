-- Nullable to preserve existing users during the authentication transition.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
