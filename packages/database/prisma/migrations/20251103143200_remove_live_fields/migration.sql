/*
  Warnings:

  - You are about to drop the column `isLiveNow` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `streamKey` on the `Video` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Video_isLiveNow_idx";

-- DropIndex
DROP INDEX "Video_streamKey_key";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "isLiveNow",
DROP COLUMN "streamKey";
