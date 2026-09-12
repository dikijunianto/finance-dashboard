"use client";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { formatMonth } from "@/lib/dates";
import { isGoalCompleted, progressPercent } from "@/lib/finance/calculations";
import { rupiah } from "@/lib/currency";
import type { getDashboardData } from "@/lib/dashboard/data";
type Data = Awaited<ReturnType<typeof getDashboardData>>;
const colors = ["#15803d", "#38bdf8", "#f59e0b", "#a78bfa", "#fb7185"];
function Card({
  title,
  value,
  caption,
  children,
}: {
  title: string;
  value: string;
  caption?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <p className="text-sm text-[var(--muted)]">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {caption && <p className="mt-2 text-xs text-[var(--muted)]">{caption}</p>}
      {children}
    </section>
  );
}
export function Dashboard({ data }: { data: Data }) {
  return (
    <div className="mx-auto max-w-7xl p-5 md:p-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="text-[var(--muted)]">
            Your financial position at a glance.
          </p>
        </div>
        <div className="rounded-xl border bg-white px-3 py-2 text-sm">
          {formatMonth(data.month)}
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Cash Available"
          value={
            data.hasAccounts ? rupiah(data.cashAvailable) : "Not available"
          }
          caption={
            data.hasAccounts
              ? "Recorded active account balances"
              : "Add an account to track your available balance."
          }
        >
          <Link
            href="/accounts"
            className="mt-3 inline-block text-sm font-semibold text-emerald-700"
          >
            {data.hasAccounts ? "Manage Accounts" : "Add Account"}
          </Link>
        </Card>
        <Card title="Monthly Surplus" value={rupiah(data.surplus)} />
        <Card
          title="Bills Remaining"
          value={rupiah(data.bills.unpaidTotal)}
          caption={`${data.bills.unpaidCount} unpaid`}
        />
        <Card
          title="Total Debt"
          value={rupiah(data.debtTotal)}
          caption={`${data.debtCount} active`}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Planned Saving Rate" value={`${data.savingRate}%`} />
        <Card
          title="Safe-to-Spend"
          value={data.hasAccounts ? rupiah(data.safe) : "Not available"}
          caption="Estimate after current obligations and planned reserves"
        />
        <Card
          title="Financial Status"
          value={
            data.hasAccounts ? data.status.label : "Not enough account data"
          }
          caption="Based on recorded cash flow and estimated reserves"
        />
      </div>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Chart title="Monthly Cash Flow">
          {data.cashFlow.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.cashFlow}>
                <XAxis dataKey="month" />
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#15803d"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#cbd5e1"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">
              No cash-flow history yet. Add income or expenses to start seeing
              monthly totals.
            </p>
          )}
        </Chart>
        <Chart title="Net Worth">
          {data.netWorth.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.netWorth}>
                <XAxis dataKey="month" />
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Area
                  dataKey="value"
                  stroke="#15803d"
                  fill="#dcfce7"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">
              No saved net-worth history yet. Historical values are shown only
              when recorded.
            </p>
          )}
        </Chart>
      </div>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Upcoming Bills</h2>
          {data.billsList.length ? (
            data.billsList.map((b) => (
              <div key={b.id} className="mt-3 flex justify-between text-sm">
                <span>
                  {b.name}
                  <small className="block text-slate-500">
                    {b.status} · {b.dueDate}
                  </small>
                </span>
                <strong>{rupiah(b.amount)}</strong>
              </div>
            ))
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No unpaid bills this month.
            </p>
          )}
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Plan Allocation</h2>
          {data.budget.length ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.budget}
                    dataKey="value"
                    isAnimationActive={false}
                    innerRadius={45}
                    outerRadius={70}
                  >
                    {data.budget.map((x, i) => (
                      <Cell key={x.name} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => rupiah(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <dl className="mt-3 space-y-2 text-sm">
                {data.budget.map((b) => (
                  <div
                    key={b.name}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <dt>{b.name}</dt>
                    <dd>{rupiah(b.value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No allocations yet. Edit your monthly Plan to allocate income.
            </p>
          )}
        </section>
      </div>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Monthly Plan</h2>
          <p className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
            <span>Income</span>
            <strong>{rupiah(data.plan.income)}</strong>
          </p>
          <p className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
            <span>Allocated</span>
            <strong>{rupiah(data.plan.allocated)}</strong>
          </p>
          <p className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
            <span>Remaining</span>
            <strong>{rupiah(data.plan.remaining)}</strong>
          </p>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Financial Notes</h2>
          {data.notes.length ? (
            <ul className="mt-4 space-y-3 text-sm">
              {data.notes.map((n) => (
                <li key={n.id}>• {n.content}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No financial notes yet.
            </p>
          )}
        </section>
      </div>
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Financial Goals</h2>
        {data.goals.length ? (
          data.goals.map((g) => (
            <p
              key={g.id}
              className="mt-3 flex flex-wrap justify-between gap-3 text-sm"
            >
              <span>{g.name}</span>
              <strong>
                {isGoalCompleted(g)
                  ? "Completed"
                  : `${progressPercent(g.currentAmount, g.targetAmount)}% · ${rupiah(Math.max(0, g.targetAmount - g.currentAmount))} remaining`}
              </strong>
            </p>
          ))
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No financial goals yet. Create a target to track your progress.
          </p>
        )}
      </section>
    </div>
  );
}
function Chart({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
