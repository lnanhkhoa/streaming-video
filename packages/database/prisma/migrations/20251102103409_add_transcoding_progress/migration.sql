-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "transcodingError" TEXT,
ADD COLUMN     "transcodingEstimatedEnd" TIMESTAMP(3),
ADD COLUMN     "transcodingProgress" INTEGER,
ADD COLUMN     "transcodingStartedAt" TIMESTAMP(3);
