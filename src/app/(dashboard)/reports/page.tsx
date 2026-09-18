import { getMonthlyReport } from "@/lib/reports/monthly-report";
import { rupiah } from "@/lib/currency";
import { formatMonth } from "@/lib/dates";
export default async function Page() {
  const r = await getMonthlyReport();
  const cards = [
    ["Income", r.income],
    ["Expenses", r.expenses],
    ["Net Cash Flow", r.net],
    ["Planned Saving Rate", r.savingRate],
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
        <span className="rounded-full border bg-white px-4 py-2 text-sm text-muted">
          {formatMonth(r.month)}
        </span>
      </header>
      <div className="summary-strip report-summary mt-8 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <section
            key={String(label)}
            className={`summary-cell ${label === "Net Cash Flow" ? "bg-soft" : ""}`}
          >
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="mt-2 block text-lg font-semibold tracking-tight sm:text-2xl">
              {label === "Planned Saving Rate"
                ? `${value}%`
                : rupiah(Number(value))}
            </strong>
          </section>
        ))}
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="panel">
          <p className="eyebrow mb-3">The monthly picture</p>
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-lg font-semibold">Income vs Expenses</h2>
            <span className="text-xs text-slate-500">
              {formatMonth(r.month)}
            </span>
          </div>
          {r.transactionCount ? (
            <div className="mt-8 space-y-8">
              {[
                ["Income", r.income],
                ["Expenses", r.expenses],
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
                    max={Math.max(1, r.income, r.expenses)}
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
                    max={Math.max(1, r.expenses)}
                    value={Math.max(0, a)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No expense data yet. Record expenses in Cash Flow to see spending
              analysis.
            </p>
          )}
        </section>
      </div>
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
        Planned saving rate uses this month’s savings allocation, not confirmed
        transfers. Expenses are recorded Cash Flow expenses; bill and debt
        payments are reported separately.
      </p>
      <section className="mt-8 grid gap-4 border-t pt-6 md:grid-cols-[1fr_2fr]">
        <h2 className="text-lg font-semibold">Financial Insight</h2>
        <p className="text-lg leading-relaxed text-slate-600">
          {r.income === 0
            ? "Record income in Cash Flow to unlock a complete monthly report."
            : r.net === 0
              ? "Your income and expenses balance this month."
              : r.net > 0
                ? "Your cash flow is positive this month."
                : "Your expenses exceed income this month."}
        </p>
      </section>
    </div>
  );
}
