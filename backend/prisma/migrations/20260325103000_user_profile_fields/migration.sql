-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- Unique email when set (PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
