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
      <p className="text-sm font-semibold text-emerald-700">
        {formatMonth(r.month)}
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Monthly Report</h1>
      <p className="mt-2 text-slate-600">Understand what changed this month.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <section
            key={String(label)}
            className="min-w-0 rounded-2xl border bg-white p-4 md:p-5"
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
      <section className="panel mt-6">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-lg font-semibold">Income vs Expenses</h2>
          <span className="text-xs text-slate-500">{formatMonth(r.month)}</span>
        </div>
        {r.transactionCount ? (
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {[
              ["Income", r.income],
              ["Expenses", r.expenses],
            ].map(([label, amount]) => (
              <div key={String(label)}>
                <div className="mb-3 flex justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <strong>{rupiah(Number(amount))}</strong>
                </div>
                <progress
                  aria-label={String(label)}
                  className={`h-3 w-full ${label === "Income" ? "accent-emerald-700" : "accent-slate-400"}`}
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
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
        <section className="panel">
          <h2 className="text-lg font-semibold">Debt & Goals</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
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
      <section className="panel mt-6 border-l-4 border-l-emerald-700">
        <h2 className="text-lg font-semibold">Financial Insight</h2>
        <p className="mt-3 text-sm text-slate-600">
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
