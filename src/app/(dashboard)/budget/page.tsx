import { PlanPage } from "@/components/plan/plan-page";
import { currentMonth, monthStart } from "@/lib/dates";
import { getPlanUsage } from "@/lib/plan-usage";
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
  const actual = await getPlanUsage(new Date(start + "T12:00:00+07:00"));
  const { funding } = actual;
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
        values={actual.allocations}
        actual={actual}
        month={start}
      />
    </>
  );
}
