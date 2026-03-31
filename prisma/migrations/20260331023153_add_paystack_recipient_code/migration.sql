/*
  Warnings:

  - Added the required column `treasurerId` to the `susu_groups` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('TREASURER', 'MEMBER');

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "memberRole" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
ALTER COLUMN "payoutPosition" DROP NOT NULL;

-- AlterTable
ALTER TABLE "susu_groups" ADD COLUMN     "treasurerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "paystackRecipientCode" TEXT;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- AddForeignKey
ALTER TABLE "susu_groups" ADD CONSTRAINT "susu_groups_treasurerId_fkey" FOREIGN KEY ("treasurerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "susu_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
