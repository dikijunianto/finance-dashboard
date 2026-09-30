CREATE TABLE "account_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"description" text NOT NULL,
	"occurred_at" date NOT NULL,
	"request_id" uuid,
	"request_hash" text
);
--> statement-breakpoint
ALTER TABLE "bill_payments" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movement_account_date_index" ON "account_movements" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "movement_reference_index" ON "account_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movement_request_unique" ON "account_movements" USING btree ("user_id","request_id");--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- The current balance is the baseline. Never replay or infer legacy transactions.
LOCK TABLE "finance_accounts" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
INSERT INTO "account_movements" ("user_id", "account_id", "type", "amount", "reference_type", "reference_id", "description", "occurred_at")
SELECT "user_id", "id", 'opening_balance', "balance", 'account', "id", 'Migration baseline — existing balance preserved', (now() AT TIME ZONE 'Asia/Jakarta')::date
FROM "finance_accounts";
