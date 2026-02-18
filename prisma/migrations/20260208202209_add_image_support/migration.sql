-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "conversation_messages" ADD COLUMN     "imageUrl" TEXT;
