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
      <div className="mx-auto max-w-6xl p-5 md:p-8">
        <h1 className="text-3xl font-semibold">Plan</h1>
        <p className="mt-2 text-slate-600">
          Allocate your income before spending it. · {formatMonth(month)}
        </p>
        <section className="mt-6 rounded-2xl bg-emerald-700 p-6 text-white">
          <p className="text-sm text-emerald-100">Monthly Income</p>
          <strong className="mt-2 block text-3xl">{rupiah(income)}</strong>
          {!income && (
            <p className="mt-2 text-sm text-emerald-100">
              Add income in Cash Flow before creating a plan.
            </p>
          )}
        </section>
        <section className="mt-6 rounded-2xl border bg-white p-6">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">Monthly Allocation</h2>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm font-semibold text-emerald-700"
              >
                Edit Plan
              </button>
            </DialogTrigger>
          </div>
          <div className="mt-5 space-y-5">
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
                  <div className="flex justify-between text-sm">
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
