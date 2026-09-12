"use client";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateMonthlyPlan } from "@/actions/plan";
import { rupiah } from "@/lib/currency";
import { allocationLabels as labels } from "@/lib/finance/calculations";
import { formatMonth } from "@/lib/dates";
import { MutationForm } from "@/components/ui/mutation-form";
import { StatusBadge } from "@/components/ui/status-badge";
export function PlanPage({
  income,
  values,
  month,
}: {
  income: number;
  values: Record<string, number>;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const allocated = Object.values(values).reduce((a, b) => a + b, 0);
  const remaining = income - allocated;
  const status =
    remaining === 0
      ? "Fully Allocated"
      : remaining > 0
        ? "Under Allocated"
        : "Over Allocated";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="page">
        <h1 className="text-3xl font-semibold">Plan</h1>
        <p className="mt-2 text-slate-600">
          Allocate your income before spending it. · {formatMonth(month)}
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="panel">
            <p className="eyebrow">{formatMonth(month)}</p>
            <p className="mt-4 text-sm text-slate-500">Monthly Income</p>
            <strong className="mt-2 block money">{rupiah(income)}</strong>
            {!income && (
              <p className="mt-2 text-sm text-slate-500">
                Add income in Cash Flow before creating a plan.
              </p>
            )}
          </section>
          <section className="panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">Remaining</p>
              <StatusBadge
                tone={
                  remaining === 0
                    ? "good"
                    : remaining > 0
                      ? "attention"
                      : "danger"
                }
              >
                {status}
              </StatusBadge>
            </div>
            <p className="mt-3 money">{rupiah(remaining)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {remaining > 0
                ? "Still needs a purpose."
                : remaining < 0
                  ? "Your allocation exceeds recorded income."
                  : "Every recorded Rupiah has a purpose."}
            </p>
          </section>
        </div>
        <section className="mt-6 rounded-2xl border bg-white p-6">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">Monthly Allocation</h2>
            <DialogTrigger asChild>
              <button type="button" className="button-primary">
                Edit Plan
              </button>
            </DialogTrigger>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-x-10">
            {Object.entries({
              ...Object.fromEntries(
                Object.keys(values).map((key) => [key, key]),
              ),
              ...labels,
            }).map(([key, label]) => {
              const amount = values[key] ?? 0;
              const pct = income ? Math.round((amount / income) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>{label}</span>
                    <strong>
                      {rupiah(amount)} · {pct}%
                    </strong>
                  </div>
                  <div className="mt-2 h-2 rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-emerald-600"
                      style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 grid gap-3 border-t pt-5 sm:grid-cols-3">
            <Metric label="Total Income" value={income} />
            <Metric label="Allocated" value={allocated} />
            <Metric label={`Remaining · ${status}`} value={remaining} />
          </div>
        </section>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
          </DialogHeader>
          <MutationForm
            action={updateMonthlyPlan}
            onSuccess={() => setOpen(false)}
          >
            <input type="hidden" name="month" value={month} />
            {Object.entries(labels).map(([key, label]) => (
              <label key={key} className="mt-3 block text-sm">
                {label}
                <input
                  name={key}
                  type="number"
                  min="0"
                  max={2147483647}
                  defaultValue={values[key] ?? 0}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
            ))}
            <DialogFooter>
              <DialogClose
                type="button"
                className="rounded-xl border px-4 py-2"
              >
                Cancel
              </DialogClose>
              <button className="rounded-xl bg-emerald-700 px-4 py-2 text-white">
                Save Plan
              </button>
            </DialogFooter>
          </MutationForm>
        </DialogContent>
      </div>
    </Dialog>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <strong>{rupiah(value)}</strong>
    </div>
  );
}
