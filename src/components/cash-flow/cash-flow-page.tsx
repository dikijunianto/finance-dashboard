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
      <div className="mx-auto max-w-6xl p-5 md:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Cash Flow</h1>
            <p className="mt-2 text-slate-600">
              Track money coming in and going out. · {formatMonth(month)}
            </p>
          </div>
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="mr-1 inline" size={17} />
              Add Transaction
            </button>
          </DialogTrigger>
        </header>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Stat label="Income" value={income} tone="green" />
          <Stat label="Expenses" value={expense} tone="red" />
          <Stat
            label="Net Cash Flow"
            value={income - expense}
            tone={income - expense >= 0 ? "green" : "red"}
          />
        </div>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="text-lg font-semibold">Transactions</h2>
              <p className="text-sm text-slate-500">
                All recorded income and expenses; summaries show the current
                month.
              </p>
            </div>
          </div>
          {items.length ? (
            items.map((tx) => (
              <div
                key={tx.type + tx.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-0"
              >
                <div className="flex gap-3">
                  <span
                    className={`grid size-9 place-items-center rounded-full ${tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                  >
                    {tx.type === "income" ? (
                      <TrendingUp size={18} />
                    ) : (
                      <TrendingDown size={18} />
                    )}
                  </span>
                  <div>
                    <strong className="text-sm">{tx.label}</strong>
                    <p className="text-xs text-slate-500">
                      {tx.type === "income" ? "Income" : "Expense"} ·{" "}
                      {formatDate(tx.date)}
                      {tx.notes ? ` · ${tx.notes}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <strong
                    className={
                      tx.type === "income"
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }
                  >
                    {tx.type === "income" ? "+ " : "- "}
                    {rupiah(tx.amount)}
                  </strong>
                  <DeleteConfirmation
                    id={tx.id}
                    name={tx.label}
                    action={tx.type === "income" ? deleteIncome : deleteExpense}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="p-10 text-center text-sm text-slate-500">
              No transactions yet. Add income or expense to start tracking cash
              flow.
            </p>
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
  tone: "green" | "red";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <strong
        className={`mt-2 block text-2xl ${tone === "green" ? "text-emerald-700" : "text-rose-700"}`}
      >
        {rupiah(value)}
      </strong>
    </section>
  );
}
