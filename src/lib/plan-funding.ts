import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { income } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getPlanFunding(month: string) {
  await requireAuth();
  // Null fallback preserves writes from v1.1 during an additive rollout.
  const sources = await db
    .select()
    .from(income)
    .where(
      eq(
        sql`coalesce(${income.fundingMonth}, date_trunc('month', ${income.receivedAt}::timestamp)::date)`,
        month,
      ),
    );
  return { amount: sources.reduce((n, row) => n + row.amount, 0), sources };
}
