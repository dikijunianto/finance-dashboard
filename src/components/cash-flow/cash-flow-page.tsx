"use client";
import { useState } from "react";
import {
  createExpense,
  createIncome,
  updateExpense,
  updateIncome,
  deleteExpense,
  deleteIncome,
  createTransfer,
  revertTransfer,
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
import {
  AccountSelect,
  type AccountOption,
} from "@/components/ui/account-select";
import {
  formatDate,
  formatMonth,
  jakartaDate,
  suggestedFundingMonth,
} from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
export type ActivityItem = {
  id: string;
  label: string;
  amount: number;
  date: string;
  notes: string;
  category: string;
  type: "income" | "expense" | "transfer" | "movement";
  accountId: string | null;
  context: string;
  linked: boolean;
  reverted?: boolean;
  fundingMonth?: string;
};
export function CashFlowPage({
  items,
  month,
  accounts,
  summary,
}: {
  items: ActivityItem[];
  month: string;
  accounts: AccountOption[];
  summary: {
    income: number;
    spending: number;
    cashOutflow: number;
    net: number;
  };
}) {
  return (
    <div className="page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Activity</h1>
          <p className="mt-2 text-muted">
            Money moving in, out and between accounts. · {formatMonth(month)}
          </p>
        </div>
        <TransactionDialog accounts={accounts} />
      </header>
      <div className="summary-strip mt-8 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income" value={summary.income} />
        <Stat label="Spending" value={summary.spending} />
        <Stat label="Cash Outflow" value={summary.cashOutflow} />
        <Stat label="Net Cash Flow" value={summary.net} />
      </div>
      <section className="mt-8">
        <h2 className="border-b pb-5 text-xl font-semibold">
          Account Activity
        </h2>
        {items.length ? (
          Object.entries(Object.groupBy(items, (tx) => tx.date))
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, rows]) => (
              <div
                key={date}
                className="mt-5 grid gap-3 xl:grid-cols-[100px_minmax(0,1fr)]"
              >
                <h3 className="pt-4 text-sm text-muted">
                  {date ? formatDate(date) : "Unknown payment date"}
                </h3>
                <div className="overflow-hidden rounded-2xl border bg-white">
                  {rows!.map((tx) => (
                    <article
                      key={tx.type + tx.id}
                      className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 last:border-0"
                    >
                      <div className="min-w-0">
                        <strong>{tx.label}</strong>
                        <p className="mt-1 text-sm text-muted">
                          {tx.type === "movement"
                            ? tx.category
                            : tx.type === "expense"
                              ? tx.category
                              : tx.type === "transfer"
                                ? "Transfer"
                                : "Income"}{" "}
                          · {tx.context}
                        </p>
                        {tx.notes && (
                          <p className="mt-1 text-sm text-muted">{tx.notes}</p>
                        )}
                        {tx.reverted && <StatusBadge>Reverted</StatusBadge>}
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-3">
                        <strong
                          className={
                            tx.type === "income" ||
                            (tx.type === "movement" && tx.amount > 0)
                              ? "text-brand"
                              : ""
                          }
                        >
                          {tx.type === "transfer"
                            ? ""
                            : tx.type === "expense" || tx.amount < 0
                              ? "− "
                              : "+ "}
                          {rupiah(Math.abs(tx.amount))}
                        </strong>
                        {(tx.type === "income" || tx.type === "expense") && (
                          <>
                            <TransactionDialog accounts={accounts} item={tx} />
                            <DeleteConfirmation
                              id={tx.id}
                              name={
                                tx.label +
                                (tx.linked
                                  ? " (reverses its account effect)"
                                  : " (legacy record only)")
                              }
                              action={
                                tx.type === "income"
                                  ? deleteIncome
                                  : deleteExpense
                              }
                            />
                          </>
                        )}
                        {tx.type === "transfer" && !tx.reverted && (
                          <TransferRevert id={tx.id} context={tx.context} />
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
        ) : (
          <EmptyState
            title="No transactions yet"
            description="Add income, an expense or a transfer to start tracking your money."
          />
        )}
      </section>
    </div>
  );
}
function TransactionDialog({
  accounts,
  item,
}: {
  accounts: AccountOption[];
  item?: ActivityItem;
}) {
  const [open, setOpen] = useState(false);
  const initialDate = item?.date ?? jakartaDate();
  const [date, setDate] = useState(initialDate);
  const [fundingMonth, setFundingMonth] = useState(
    item?.fundingMonth?.slice(0, 7) ??
      suggestedFundingMonth(initialDate).slice(0, 7),
  );
  const [fundingChosen, setFundingChosen] = useState(!!item);
  const [type, setType] = useState<"income" | "expense" | "transfer">(
    item?.type === "expense" ? "expense" : "income",
  );
  const reset = () => {
    setType(item?.type === "expense" ? "expense" : "income");
    setDate(initialDate);
    setFundingMonth(
      item?.fundingMonth?.slice(0, 7) ??
        suggestedFundingMonth(initialDate).slice(0, 7),
    );
    setFundingChosen(!!item);
  };
  const action =
    type === "transfer"
      ? createTransfer
      : type === "income"
        ? item
          ? updateIncome
          : createIncome
        : item
          ? updateExpense
          : createExpense;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={item ? "button-secondary" : "button-primary"}
        >
          {item ? "Edit" : "Add Transaction"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
        </DialogHeader>
        {item && !item.linked && (
          <p className="text-sm text-muted">
            This legacy record has no balance effect. Selecting an account
            applies the full updated amount to that account. For income, keep it
            unlinked to change only its Plan funding.
          </p>
        )}
        <MutationForm
          key={type}
          action={action}
          onSuccess={() => {
            setOpen(false);
            reset();
          }}
        >
          {item && <input type="hidden" name="id" value={item.id} />}
          {!item && (
            <div className="mt-4 flex rounded-lg bg-soft p-1">
              {(["income", "expense", "transfer"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={
                    "flex-1 rounded-md py-2 text-sm capitalize " +
                    (type === t ? "bg-white font-semibold shadow-sm" : "")
                  }
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
          {type !== "transfer" && (
            <label className="mt-4 block text-sm">
              {type === "income" ? "Source" : "Description"}
              <input
                name="label"
                required
                defaultValue={item?.label ?? ""}
                className="mt-2 w-full rounded-xl border p-2.5"
              />
            </label>
          )}
          {type === "expense" && (
            <label className="mt-4 block text-sm">
              Category
              <input
                name="category"
                required
                defaultValue={item?.category ?? ""}
                className="mt-2 w-full rounded-xl border p-2.5"
              />
            </label>
          )}
          <label className="mt-4 block text-sm">
            Amount
            <input
              name="amount"
              type="number"
              min="1"
              max={2147483647}
              step="1"
              required
              defaultValue={item?.amount ?? ""}
              className="mt-2 w-full rounded-xl border p-2.5"
            />
          </label>
          {type === "transfer" ? (
            <>
              <AccountSelect
                accounts={accounts}
                name="fromAccountId"
                label="From Account"
              />
              <AccountSelect
                accounts={accounts}
                name="toAccountId"
                label="To Account"
              />
            </>
          ) : (
            <AccountSelect
              accounts={accounts}
              label={type === "income" ? "Received To" : "Paid From"}
              retainCurrent={type === "income" && !!item?.accountId}
              required={!(type === "income" && item && !item.linked)}
              defaultValue={
                item && (item.linked || type === "income")
                  ? (item.accountId ?? "")
                  : ""
              }
            />
          )}
          <label className="mt-4 block text-sm">
            Date
            <input
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (!fundingChosen && e.target.value)
                  setFundingMonth(
                    suggestedFundingMonth(e.target.value).slice(0, 7),
                  );
              }}
              className="mt-2 w-full rounded-xl border p-2.5"
            />
          </label>
          {type === "income" && (
            <label className="mt-4 block text-sm">
              Use for Plan
              <input
                aria-label="Use for Plan"
                type="month"
                required
                value={fundingMonth}
                onChange={(e) => {
                  setFundingMonth(e.target.value);
                  setFundingChosen(true);
                }}
                className="mt-2 w-full rounded-xl border p-2.5"
              />
              <input
                type="hidden"
                name="fundingMonth"
                value={fundingMonth + "-01"}
              />
              <span className="mt-1 block text-xs text-muted">
                Choose the month this income is intended to fund. Date remains
                the actual receipt date.
              </span>
            </label>
          )}
          <label className="mt-4 block text-sm">
            Notes
            <input
              name="notes"
              defaultValue={item?.notes ?? ""}
              className="mt-2 w-full rounded-xl border p-2.5"
            />
          </label>
          <DialogFooter>
            <DialogClose type="button" className="button-secondary">
              Cancel
            </DialogClose>
            <button
              type="submit"
              className="button-primary"
              disabled={
                !accounts.some((a) => a.isActive) &&
                !(type === "income" && item)
              }
            >
              {type === "transfer"
                ? "Save Transfer"
                : type === "income"
                  ? "Save Income"
                  : "Save Expense"}
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
function TransferRevert({ id, context }: { id: string; context: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="button-secondary">
          Revert
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revert Transfer</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted">
          {context}. Both account effects will be reversed; the original
          movement history remains.
        </p>
        <MutationForm action={revertTransfer} onSuccess={() => setOpen(false)}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose type="button" className="button-secondary">
              Cancel
            </DialogClose>
            <button className="button-primary">Revert Transfer</button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <section
      className={"summary-cell " + (label === "Net Cash Flow" ? "bg-soft" : "")}
    >
      <p className="text-sm text-muted">{label}</p>
      <strong className="mt-2 block money">{rupiah(value)}</strong>
    </section>
  );
}
