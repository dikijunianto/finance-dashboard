ALTER TABLE "income" ADD COLUMN "funding_month" date;
--> statement-breakpoint
UPDATE "income" SET "funding_month" = date_trunc('month', "received_at"::timestamp)::date;
