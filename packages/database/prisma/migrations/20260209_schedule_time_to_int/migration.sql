-- Convert startTime and endTime from String (HH:MM) to Int (minutes from midnight)
ALTER TABLE "Schedule" ADD COLUMN "startTime_new" INTEGER;
ALTER TABLE "Schedule" ADD COLUMN "endTime_new" INTEGER;

UPDATE "Schedule" SET "startTime_new" = CAST(SPLIT_PART("startTime",':',1) AS INT)*60 + CAST(SPLIT_PART("startTime",':',2) AS INT) WHERE "startTime" IS NOT NULL;
UPDATE "Schedule" SET "endTime_new" = CAST(SPLIT_PART("endTime",':',1) AS INT)*60 + CAST(SPLIT_PART("endTime",':',2) AS INT) WHERE "endTime" IS NOT NULL;

ALTER TABLE "Schedule" DROP COLUMN "startTime";
ALTER TABLE "Schedule" DROP COLUMN "endTime";
ALTER TABLE "Schedule" RENAME COLUMN "startTime_new" TO "startTime";
ALTER TABLE "Schedule" RENAME COLUMN "endTime_new" TO "endTime";
