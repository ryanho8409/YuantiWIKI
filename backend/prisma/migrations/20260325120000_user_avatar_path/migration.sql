-- Replace external avatar URL with server-side relative path
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarUrl";
ALTER TABLE "User" ADD COLUMN "avatarPath" TEXT;
