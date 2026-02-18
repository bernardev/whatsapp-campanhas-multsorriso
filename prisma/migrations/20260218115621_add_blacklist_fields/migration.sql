-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "blacklistReason" TEXT,
ADD COLUMN     "blacklistedAt" TIMESTAMP(3),
ADD COLUMN     "blacklistedBy" TEXT;
