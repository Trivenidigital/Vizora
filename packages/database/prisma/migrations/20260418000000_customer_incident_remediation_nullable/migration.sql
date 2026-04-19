-- R4-BLOCK1: make CustomerIncident.remediation nullable
-- The DTO marks it @IsOptional() (agents may create incidents with no remediation text
-- at detection time and fill it in later). Prior NOT NULL constraint caused P2000
-- runtime errors when DTO-valid requests were rejected at the DB layer.

ALTER TABLE "customer_incidents" ALTER COLUMN "remediation" DROP NOT NULL;
