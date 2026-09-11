import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { budgets, income } from "@/db/schema";
import { PlanPage } from "@/components/plan/plan-page";
import { allocationTotals } from "@/lib/finance/calculations";
import { currentMonth } from "@/lib/dates";
import { requireAuth } from "@/lib/auth/require-auth";
export default async function Page() {
  await requireAuth();
  const { start, next } = currentMonth();
  const [incomeRows, budgetRows] = await Promise.all([
    db
      .select()
      .from(income)
      .where(and(gte(income.receivedAt, start), lt(income.receivedAt, next))),
    db
      .select()
      .from(budgets)
      .where(and(gte(budgets.month, start), lt(budgets.month, next))),
  ]);
  return (
    <PlanPage
      income={incomeRows.reduce((n, x) => n + x.amount, 0)}
      values={allocationTotals(budgetRows)}
      month={start}
    />
  );
}
