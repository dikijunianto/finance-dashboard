import { getMonthlyReport } from "@/lib/reports/monthly-report";
import { rupiah } from "@/lib/currency";
import { formatMonth, monthStart, currentMonth } from "@/lib/dates";
import { MonthSelect } from "@/components/ui/month-select";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const month =
    monthStart((await searchParams).month ?? "") ?? currentMonth().start;
  const r = await getMonthlyReport(new Date(month + "T12:00:00+07:00"));
  const cards = [
    ["Income", r.income],
    ["Spending", r.spending],
    ["Cash Outflow", r.cashOutflow],
    ["Net Cash Flow", r.net],
  ];
  return (
    <div className="page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Monthly Report</h1>
          <p className="mt-2 text-slate-600">
            Understand what changed this month.
          </p>
        </div>
        <MonthSelect month={month} />
      </header>
      <div className="summary-strip report-summary mt-8 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <section
            key={String(label)}
            className={`summary-cell ${label === "Net Cash Flow" ? "bg-soft" : ""}`}
          >
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="mt-2 block text-lg font-semibold tracking-tight sm:text-2xl">
              {rupiah(Number(value))}
            </strong>
          </section>
        ))}
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="panel">
          <p className="eyebrow mb-3">The monthly picture</p>
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-lg font-semibold">Income vs Cash Outflow</h2>
            <span className="text-xs text-slate-500">
              {formatMonth(r.month)}
            </span>
          </div>
          {r.transactionCount ? (
            <div className="mt-8 space-y-8">
              {[
                ["Income", r.income],
                ["Cash Outflow", r.cashOutflow],
              ].map(([label, amount]) => (
                <div key={String(label)}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 text-sm">
                    <span>{label}</span>
                    <strong className="text-2xl font-semibold">
                      {rupiah(Number(amount))}
                    </strong>
                  </div>
                  <progress
                    aria-label={String(label)}
                    className={`h-4 w-full ${label === "Income" ? "accent-emerald-700" : "accent-slate-400"}`}
                    max={Math.max(1, r.income, r.cashOutflow)}
                    value={Math.max(0, Number(amount))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No cash flow recorded this month. A comparison appears when
              transactions are available.
            </p>
          )}
        </section>
        <section className="panel">
          <h2 className="text-lg font-semibold">Spending Breakdown</h2>
          {r.categories.length ? (
            <div className="mt-4 space-y-3">
              {r.categories.map(([c, a]) => (
                <div key={c} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{c}</span>
                    <strong>{rupiah(a)}</strong>
                  </div>
                  <progress
                    aria-label={`${c} spending`}
                    className="mt-2 h-1.5 w-full accent-slate-400"
                    max={Math.max(1, r.spending)}
                    value={Math.max(0, a)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No spending data yet. Record expenses in Activity or pay bills to
              see spending analysis.
            </p>
          )}
        </section>
      </div>
      <section className="panel mt-5">
        <h2 className="text-lg font-semibold">Cash Outflow Composition</h2>
        <div className="mt-4 flex flex-wrap gap-6">
          {[
            ["Spending", r.spending],
            ["Debt Payments", r.debtPaid],
            ["Total Cash Outflow", r.cashOutflow],
          ].map(([label, value]) => (
            <p key={String(label)} className="text-sm text-muted">
              {label}
              <strong className="mt-1 block text-ink">
                {rupiah(Number(value))}
              </strong>
            </p>
          ))}
        </div>
      </section>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-soft p-6">
          <h2 className="text-lg font-semibold">Debt Progress</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 text-sm">
            <p>
              Debt paid
              <br />
              <strong className="mt-2 block text-xl">
                {rupiah(r.debtPaid)}
              </strong>
            </p>
            <p>
              Remaining debt
              <br />
              <strong className="mt-2 block text-xl">
                {rupiah(r.debtRemaining)}
              </strong>
            </p>
          </div>
        </section>
        <section className="rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Goals Summary</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <p>
              Active goals
              <br />
              <strong className="mt-2 block text-xl">{r.activeGoals}</strong>
            </p>
            <p>
              Completed goals
              <br />
              <strong className="mt-2 block text-xl">{r.completedGoals}</strong>
            </p>
          </div>
        </section>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Planned saving rate: {r.savingRate}% — based on savings allocations, not
        actual cash movements. Spending includes manual expenses and paid bills.
        Debt payments count only toward cash outflow, not spending.
      </p>
      <section className="mt-8 grid gap-4 border-t pt-6 md:grid-cols-[1fr_2fr]">
        <h2 className="text-lg font-semibold">Financial Insight</h2>
        <p className="text-lg leading-relaxed text-slate-600">
          {r.income === 0
            ? "Record income in Activity to complete this monthly picture."
            : r.net === 0
              ? "Your income and cash outflow balance this month."
              : r.net > 0
                ? "Your cash flow is positive this month."
                : "Your cash outflow exceeds income this month."}
        </p>
      </section>
    </div>
  );
}
