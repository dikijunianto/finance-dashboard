CREATE TABLE "transfer_plan_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_category" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "plan_category" text;--> statement-breakpoint
ALTER TABLE "transfer_plan_attributions" ADD CONSTRAINT "transfer_plan_attributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Preserve the original category. Only exact, unambiguous names are mapped.
UPDATE expenses SET plan_category = CASE lower(trim(category))
  WHEN 'bills_debt' THEN 'bills_debt'
  WHEN 'living' THEN 'living' WHEN 'makan' THEN 'living'
  WHEN 'kebutuhan' THEN 'living' WHEN 'food' THEN 'living'
  WHEN 'lifestyle' THEN 'lifestyle' WHEN 'entertainment' THEN 'lifestyle'
  WHEN 'investment' THEN 'investments' WHEN 'investments' THEN 'investments'
  WHEN 'savings' THEN 'savings' WHEN 'saving' THEN 'savings'
  WHEN 'buffer' THEN 'buffer' ELSE NULL END
WHERE plan_category IS NULL;
--> statement-breakpoint
-- Attribute only intact, owned liquid-to-investment pairs. No balance writes.
INSERT INTO transfer_plan_attributions(id,user_id,plan_category)
SELECT outgoing.reference_id, outgoing.user_id, 'investments'
FROM account_movements outgoing
JOIN finance_accounts source ON source.id=outgoing.account_id AND source.user_id=outgoing.user_id
JOIN account_movements incoming ON incoming.reference_id=outgoing.reference_id
  AND incoming.user_id=outgoing.user_id AND incoming.reference_type='transfer'
  AND incoming.type='transfer_in' AND incoming.amount=-outgoing.amount
  AND incoming.occurred_at=outgoing.occurred_at
JOIN finance_accounts destination ON destination.id=incoming.account_id AND destination.user_id=incoming.user_id
WHERE outgoing.reference_type='transfer' AND outgoing.type='transfer_out' AND outgoing.amount<0
  AND source.is_active AND source.type IN ('bank','cash','e_wallet')
  AND destination.type='investment'
  AND NOT EXISTS (SELECT 1 FROM account_movements reversed WHERE reversed.reference_type='transfer'
    AND reversed.reference_id=outgoing.reference_id AND reversed.user_id=outgoing.user_id AND reversed.type='reversal')
GROUP BY outgoing.reference_id,outgoing.user_id
HAVING count(*)=1
ON CONFLICT (id) DO NOTHING;
