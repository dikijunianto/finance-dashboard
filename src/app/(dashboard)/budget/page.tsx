import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { PlanPage } from "@/components/plan/plan-page";
import { allocationTotals } from "@/lib/finance/calculations";
import { currentMonth, monthStart } from "@/lib/dates";
import { getPlanFunding } from "@/lib/plan-funding";
import { MonthSelect } from "@/components/ui/month-select";
import { requireAuth } from "@/lib/auth/require-auth";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAuth();
  const start =
    monthStart((await searchParams).month ?? "") ?? currentMonth().start;
  const { next } = currentMonth(new Date(start + "T12:00:00+07:00"));
  const [funding, budgetRows] = await Promise.all([
    getPlanFunding(start),
    db
      .select()
      .from(budgets)
      .where(and(gte(budgets.month, start), lt(budgets.month, next))),
  ]);
  return (
    <>
      <div className="page pb-0">
        <MonthSelect month={start} />
      </div>
      <PlanPage
        key={start}
        income={funding.amount}
        sources={funding.sources.map((x) => ({
          id: x.id,
          source: x.source,
          date: x.receivedAt,
          amount: x.amount,
        }))}
        values={allocationTotals(budgetRows)}
        month={start}
      />
    </>
  );
}
