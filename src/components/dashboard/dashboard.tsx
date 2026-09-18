"use client";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { formatMonth } from "@/lib/dates";
import { isGoalCompleted, progressPercent } from "@/lib/finance/calculations";
import { rupiah } from "@/lib/currency";
import { StatusBadge } from "@/components/ui/status-badge";
import type { getDashboardData } from "@/lib/dashboard/data";
type Data = Awaited<ReturnType<typeof getDashboardData>>;

export function Dashboard({ data }: { data: Data }) {
  const planStatus =
    data.plan.remaining === 0
      ? "Fully Allocated"
      : data.plan.remaining > 0
        ? "Under Allocated"
        : "Over Allocated";
  const planTone =
    data.plan.remaining === 0
      ? "good"
      : data.plan.remaining > 0
        ? "attention"
        : "danger";
  const attention = [
    ...(!data.hasAccounts
      ? [
          {
            title: "Give your cash a starting point",
            detail: "Add an account to see your available balance.",
            href: "/accounts",
          },
        ]
      : []),
    ...(data.plan.remaining !== 0
      ? [
          {
            title:
              data.plan.remaining > 0
                ? "Give every Rupiah a purpose"
                : "Review your monthly allocation",
            detail:
              rupiah(Math.abs(data.plan.remaining)) +
              (data.plan.remaining > 0
                ? " still unallocated."
                : " over allocated."),
            href: "/budget",
          },
        ]
      : !data.budget.length
        ? [
            {
              title: "Start your monthly allocation",
              detail:
                "No positive allocations recorded. Give your income a purpose in Plan.",
              href: "/budget",
            },
          ]
        : []),
    ...(data.bills.unpaidCount
      ? [
          {
            title:
              data.bills.unpaidCount +
              (data.bills.unpaidCount === 1
                ? " unpaid bill this month"
                : " unpaid bills this month"),
            detail:
              rupiah(data.bills.unpaidTotal) +
              " remaining. Review your upcoming obligations.",
            href: "/bills",
          },
        ]
      : []),
  ].slice(0, 3);
  return (
    <div className="page space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Overview</h1>
          <p className="mt-2 text-slate-500">
            Your financial position at a glance.
          </p>
        </div>
        <span className="rounded-full border bg-white px-4 py-2 text-sm text-slate-600">
          {formatMonth(data.month)}
        </span>
      </header>
      <div className="overview-grid">
        <section className="overview-hero cash-hero flex min-w-0 flex-col justify-between rounded-2xl p-6 md:p-8">
          <div>
            <p className="eyebrow">Now · Your money</p>
            <p className="mt-8 hero-amount">
              {data.hasAccounts ? rupiah(data.cashAvailable) : "Not available"}
            </p>
            <p className="mt-2 text-lg font-medium">Cash Available</p>
            <p className="mt-3 max-w-md text-sm text-slate-600">
              {data.hasAccounts
                ? "Your recorded balances across active banks, cash, and wallets."
                : "Add an account to track your available balance."}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-5 border-t border-ink/10 pt-5">
            <div>
              <p className="text-sm text-muted">Monthly Surplus</p>
              <p className="mt-1 text-2xl font-semibold">
                {rupiah(data.surplus)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Income less recorded expenses
              </p>
            </div>
            <Link href="/accounts" className="button-primary w-fit">
              {data.hasAccounts ? "Manage Accounts" : "Add Account"}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <section className="overview-safe panel">
          <p className="eyebrow mb-4">Room to breathe</p>
          <Metric
            title="Safe-to-Spend"
            value={data.hasAccounts ? rupiah(data.safe) : "Not available"}
            caption="After obligations and planned reserves"
          />
        </section>
        <section className="overview-obligations panel divide-y">
          <Metric
            title="Bills Remaining"
            value={rupiah(data.bills.unpaidTotal)}
            caption={data.bills.unpaidCount + " unpaid this month"}
          />
          <Metric
            title="Total Debt"
            value={rupiah(data.debtTotal)}
            caption={data.debtCount + " active debts"}
          />
        </section>
        <section className="overview-attention rounded-2xl border border-brand/15 bg-brand-soft/40 p-5 md:p-6">
          <p className="eyebrow mb-3">Next · Stay one step ahead</p>
          <h2 className="text-lg font-semibold">Needs your attention</h2>
          {attention.length ? (
            <div className="mt-3 divide-y">
              {attention.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-4 py-4 hover:text-emerald-800"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                  <ArrowUpRight size={18} className="shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3">
              <CheckCircle2 className="text-emerald-700" size={20} />
              <div>
                <p className="font-medium">You’re on track</p>
                <p className="mt-1 text-sm text-slate-500">
                  No urgent financial items right now.
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="overview-cashflow panel">
          <p className="eyebrow mb-3">This month</p>
          <SectionTitle
            title="Monthly Cash Flow"
            href="/cash-flow"
            label="View activity"
          />
          {data.cashFlow.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.cashFlow}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="var(--green)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="var(--muted)"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : data.cashFlow.length ? (
            <div className="mt-6">
              <div className="grid gap-5 sm:grid-cols-3">
                {[
                  ["Income", data.cashFlow[0].income],
                  ["Expenses", data.cashFlow[0].expenses],
                  ["Net Cash Flow", data.surplus],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">
                      {rupiah(Number(value))}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6 border-t pt-4 text-xs text-slate-500">
                {formatMonth(data.month)} · A trend appears when multiple months
                are available.
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No cash-flow history yet. Add income or expenses to start seeing
              monthly totals.
            </p>
          )}
        </section>
        <section className="overview-plan panel">
          <p className="eyebrow mb-3">Progress · Give every Rupiah a purpose</p>
          <SectionTitle title="Monthly Plan" href="/budget" label="View Plan" />
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight">
                {data.plan.income > 0
                  ? `${Math.round((data.plan.allocated / data.plan.income) * 100)}%`
                  : "—"}
                <span className="ml-2 text-base font-normal text-muted">
                  allocated
                </span>
              </p>
              <StatusBadge tone={planTone}>{planStatus}</StatusBadge>
            </div>
            <progress
              aria-label="Income allocated"
              className="h-3 w-full accent-emerald-700"
              value={Math.max(
                0,
                Math.min(data.plan.allocated, Math.max(0, data.plan.income)),
              )}
              max={Math.max(1, data.plan.income)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Income", data.plan.income],
                ["Allocated", data.plan.allocated],
                ["Remaining", data.plan.remaining],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-1 text-lg font-semibold">
                    {rupiah(Number(value))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="overview-upcoming panel">
          <SectionTitle title="Upcoming Bills" href="/bills" label="View all" />
          {data.billsList.length ? (
            <div className="mt-3 divide-y">
              {data.billsList.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="max-w-20 border-l-2 border-brand/25 pl-3 text-xs font-medium text-slate-600">
                      {b.dueDate}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{b.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Monthly · Unpaid
                      </p>
                    </div>
                  </div>
                  <strong className="text-sm">{rupiah(b.amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No unpaid bills this month.
            </p>
          )}
        </section>
        <section className="overview-goals panel">
          <SectionTitle
            title="Financial Goals"
            href="/goals"
            label="View Goals"
          />
          {data.goals.length ? (
            <div className="mt-4 divide-y">
              {data.goals.map((g) => {
                const done = isGoalCompleted(g);
                const percent = done
                  ? 100
                  : progressPercent(g.currentAmount, g.targetAmount);
                return (
                  <div key={g.id} className="py-4 first:pt-0">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-semibold">{g.name}</p>
                      {done ? (
                        <StatusBadge tone="good">Completed</StatusBadge>
                      ) : (
                        <span className="text-sm text-slate-500">
                          {percent}%
                        </span>
                      )}
                    </div>
                    <progress
                      aria-label={g.name + " progress"}
                      value={percent}
                      max={100}
                      className="mt-3 h-2 w-full accent-emerald-700"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {rupiah(g.currentAmount)} of {rupiah(g.targetAmount)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">
              No financial goals yet. Create a target to track your progress.
            </p>
          )}
        </section>
        <section className="overview-health rounded-2xl border bg-soft p-5 md:p-6">
          <h2 className="text-lg font-semibold">Financial Health</h2>
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <span className="text-slate-500">Financial Status</span>
              <strong>
                {data.hasAccounts
                  ? data.status.label
                  : "Not enough account data"}
              </strong>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-slate-500">Planned Saving Rate</span>
              <strong>{data.savingRate}%</strong>
            </div>
            <Amount
              label="Safe-to-Spend"
              value={data.hasAccounts ? data.safe : null}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">Plan Status</span>
              <StatusBadge tone={planTone}>{planStatus}</StatusBadge>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Based on recorded balances, current obligations, and planned
              reserves. Saving rate reflects your plan, not confirmed transfers.
            </p>
          </div>
        </section>
        <section className="overview-history panel">
          <h2 className="text-lg font-semibold">Net Worth</h2>
          {data.netWorth.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.netWorth}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => rupiah(Number(v))} />
                <Area
                  dataKey="value"
                  stroke="var(--green)"
                  fill="var(--green-soft)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {data.netWorth.length
                ? rupiah(data.netWorth[0].value) +
                  " recorded for " +
                  data.netWorth[0].month +
                  ". More history is needed for a trend."
                : "No saved net-worth history yet. Historical values are shown only when recorded."}
            </p>
          )}
        </section>
        <section className="overview-notes rounded-2xl border p-5 md:p-6">
          <SectionTitle
            title="Financial Notes"
            href="/settings"
            label="View notes"
          />
          {data.notes.length ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {data.notes.map((n) => (
                <li key={n.id} className="border-l-2 border-emerald-100 pl-3">
                  {n.content}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No financial notes yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
function Metric({
  title,
  value,
  caption,
}: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="min-w-0 py-3 first:pt-0 last:pb-0">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
    </div>
  );
}
function SectionTitle({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Link
        href={href}
        className="text-xs font-semibold text-emerald-700 hover:underline"
      >
        {label}
      </Link>
    </div>
  );
}
function Amount({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <strong>{value === null ? "Not available" : rupiah(value)}</strong>
    </div>
  );
}
