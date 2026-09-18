"use client";
import { useState } from "react";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import {
  createExpense,
  createIncome,
  deleteExpense,
  deleteIncome,
} from "@/actions/cash-flow";
import { rupiah } from "@/lib/currency";
import {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MutationForm,
  DeleteConfirmation,
} from "@/components/ui/mutation-form";
import { formatDate, formatMonth } from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";
type Tx = {
  id: string;
  label: string;
  amount: number;
  date: string;
  notes: string;
  type: "income" | "expense";
};
export function CashFlowPage({ items, month }: { items: Tx[]; month: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("income");
  const income = items
    .filter((x) => x.type === "income" && x.date.startsWith(month))
    .reduce((n, x) => n + x.amount, 0);
  const expense = items
    .filter((x) => x.type === "expense" && x.date.startsWith(month))
    .reduce((n, x) => n + x.amount, 0);
  const action = type === "income" ? createIncome : createExpense;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setType("income");
      }}
    >
      <div className="page">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Cash Flow</h1>
            <p className="mt-2 text-slate-600">
              Track money coming in and going out. · {formatMonth(month)}
            </p>
          </div>
          {items.length > 0 && (
            <DialogTrigger asChild>
              <button
                type="button"
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="mr-1 inline" size={17} />
                Add Transaction
              </button>
            </DialogTrigger>
          )}
        </header>
        <div className="summary-strip mt-8 sm:grid-cols-3">
          <Stat label="Income" value={income} tone="green" />
          <Stat label="Expenses" value={expense} tone="neutral" />
          <Stat
            label="Net Cash Flow"
            value={income - expense}
            tone={income - expense >= 0 ? "green" : "red"}
          />
        </div>
        <section className="mt-8">
          <div className="flex items-center justify-between border-b pb-5">
            <div>
              <h2 className="text-xl font-semibold">Cash Flow Activity</h2>
              <p className="text-sm text-slate-500">
                All recorded income and expenses; summaries show the current
                month.
              </p>
            </div>
          </div>
          {items.length ? (
            Object.entries(Object.groupBy(items, (tx) => tx.date))
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, transactions]) => (
                <div
                  key={date}
                  className="mt-5 grid gap-3 xl:grid-cols-[100px_minmax(0,1fr)]"
                >
                  <h3 className="pt-4 text-sm font-medium text-muted">
                    {formatDate(date)}
                  </h3>
                  <div className="overflow-hidden rounded-2xl border bg-white">
                    {transactions!.map((tx) => (
                      <div
                        key={tx.type + tx.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-0"
                      >
                        <div className="flex min-w-0 gap-3">
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-xl ${tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                          >
                            {tx.type === "income" ? (
                              <TrendingUp size={18} />
                            ) : (
                              <TrendingDown size={18} />
                            )}
                          </span>
                          <div>
                            <strong className="text-base">{tx.label}</strong>
                            <p className="mt-1 text-sm text-slate-500">
                              {tx.type === "income" ? "Income" : "Expense"} ·{" "}
                              {formatDate(tx.date)}
                              {tx.notes ? ` · ${tx.notes}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="ml-auto flex flex-wrap items-center gap-3">
                          <strong
                            className={
                              tx.type === "income"
                                ? "text-emerald-700"
                                : "text-slate-700"
                            }
                          >
                            {tx.type === "income" ? "+ " : "- "}
                            {rupiah(tx.amount)}
                          </strong>
                          <DeleteConfirmation
                            id={tx.id}
                            name={tx.label}
                            action={
                              tx.type === "income"
                                ? deleteIncome
                                : deleteExpense
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <EmptyState
              title="No transactions yet"
              description="Record income or expenses to understand where your money goes."
            >
              <DialogTrigger asChild>
                <button type="button" className="button-primary">
                  Add Transaction
                </button>
              </DialogTrigger>
            </EmptyState>
          )}
        </section>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <MutationForm
            key={type}
            action={action}
            onSuccess={() => {
              setOpen(false);
              setType("income");
            }}
          >
            <div className="mt-4 flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setType("income")}
                className={`flex-1 rounded-md py-2 text-sm ${type === "income" ? "bg-white font-semibold shadow" : ""}`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`flex-1 rounded-md py-2 text-sm ${type === "expense" ? "bg-white font-semibold shadow" : ""}`}
              >
                Expense
              </button>
            </div>
            <label className="mt-4 block text-sm">
              {type === "income" ? "Source" : "Description"}
              <input
                name="label"
                required
                className="mt-1 w-full rounded-xl border p-2.5"
              />
            </label>
            <label className="mt-3 block text-sm">
              Amount
              <input
                name="amount"
                type="number"
                min="1"
                max={2147483647}
                required
                className="mt-1 w-full rounded-xl border p-2.5"
              />
            </label>
            <label className="mt-3 block text-sm">
              Date
              <input
                name="date"
                type="date"
                required
                className="mt-1 w-full rounded-xl border p-2.5"
              />
            </label>
            <label className="mt-3 block text-sm">
              {type === "income" ? "Notes" : "Category"}
              <input
                name="notes"
                className="mt-1 w-full rounded-xl border p-2.5"
              />
            </label>
            <DialogFooter>
              <DialogClose
                type="button"
                className="rounded-xl border px-3 py-2 text-sm"
              >
                Cancel
              </DialogClose>
              <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
                Save {type === "income" ? "Income" : "Expense"}
              </button>
            </DialogFooter>
          </MutationForm>
        </DialogContent>
      </div>
    </Dialog>
  );
}
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "neutral";
}) {
  return (
    <section
      className={`summary-cell ${label === "Net Cash Flow" ? "bg-soft" : ""}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <strong
        className={`mt-2 block money ${tone === "green" ? "text-emerald-800" : tone === "red" ? "text-rose-700" : "text-slate-800"}`}
      >
        {rupiah(value)}
      </strong>
    </section>
  );
}
