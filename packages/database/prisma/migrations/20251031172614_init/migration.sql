-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'LIVE');

-- CreateEnum
CREATE TYPE "VideoVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('VOD', 'LIVE');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "VideoVisibility" NOT NULL DEFAULT 'PUBLIC',
    "videoType" "VideoType" NOT NULL DEFAULT 'VOD',
    "originalKey" TEXT,
    "originalSize" INTEGER,
    "originalFormat" TEXT,
    "hlsManifestKey" TEXT,
    "streamKey" TEXT,
    "isLiveNow" BOOLEAN NOT NULL DEFAULT false,
    "viewsToday" INTEGER NOT NULL DEFAULT 0,
    "viewsMonth" INTEGER NOT NULL DEFAULT 0,
    "viewsTotal" INTEGER NOT NULL DEFAULT 0,
    "lastViewReset" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoVariant" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "bitrate" INTEGER NOT NULL,
    "codec" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoViewLog" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "VideoViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_originalKey_key" ON "Video"("originalKey");

-- CreateIndex
CREATE UNIQUE INDEX "Video_streamKey_key" ON "Video"("streamKey");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "Video_visibility_idx" ON "Video"("visibility");

-- CreateIndex
CREATE INDEX "Video_videoType_idx" ON "Video"("videoType");

-- CreateIndex
CREATE INDEX "Video_isLiveNow_idx" ON "Video"("isLiveNow");

-- CreateIndex
CREATE INDEX "VideoVariant_videoId_idx" ON "VideoVariant"("videoId");

-- CreateIndex
CREATE INDEX "VideoViewLog_videoId_idx" ON "VideoViewLog"("videoId");

-- CreateIndex
CREATE INDEX "VideoViewLog_viewedAt_idx" ON "VideoViewLog"("viewedAt");

-- AddForeignKey
ALTER TABLE "VideoVariant" ADD CONSTRAINT "VideoVariant_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoViewLog" ADD CONSTRAINT "VideoViewLog_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
