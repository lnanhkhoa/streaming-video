/*
  Warnings:

  - Added the required column `playlistKey` to the `VideoVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "thumbnailKey" TEXT;

-- AlterTable
ALTER TABLE "VideoVariant" ADD COLUMN     "playlistKey" TEXT NOT NULL;
