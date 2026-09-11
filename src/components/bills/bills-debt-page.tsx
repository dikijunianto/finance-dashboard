"use client";
import { useState } from "react";
import {
  createBill,
  createDebt,
  deleteBill,
  deleteDebt,
  markBillPaid,
  recordDebtPayment,
} from "@/actions/bills-debt";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rupiah } from "@/lib/currency";
import {
  MutationForm,
  DeleteConfirmation,
} from "@/components/ui/mutation-form";
import { isDebtPaidOff, progressPercent } from "@/lib/finance/calculations";
import { formatMonth } from "@/lib/dates";
type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  notes: string | null;
  isActive: boolean;
};
type Debt = {
  id: string;
  name: string;
  remainingAmount: number;
  originalAmount: number;
  installmentAmount: number;
  status: string;
  dueDay: number;
};
export function BillsDebtPage({
  bills,
  debts,
  paidBillIds,
  paidTotal,
  month,
}: {
  bills: Bill[];
  debts: Debt[];
  paidBillIds: string[];
  paidTotal: number;
  month: string;
}) {
  const [tab, setTab] = useState<"bills" | "debt">("bills");
  const activeDebts = debts.filter((debt) => !isDebtPaidOff(debt));
  const unpaid = bills.filter((b) => b.isActive && !paidBillIds.includes(b.id));
  const remaining = unpaid.reduce((n, b) => n + Math.max(0, b.amount), 0);
  const total = activeDebts.reduce(
    (sum, debt) => sum + debt.remainingAmount,
    0,
  );
  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <h1 className="text-3xl font-semibold">Bills & Debt</h1>
      <p className="mt-2 text-slate-600">
        Stay ahead of upcoming obligations. · {formatMonth(month)}
      </p>
      <div className="mt-6 flex gap-2 border-b">
        <button
          onClick={() => setTab("bills")}
          className={`px-4 py-3 text-sm ${tab === "bills" ? "border-b-2 border-emerald-700 font-semibold text-emerald-700" : "text-slate-500"}`}
        >
          Bills
        </button>
        <button
          onClick={() => setTab("debt")}
          className={`px-4 py-3 text-sm ${tab === "debt" ? "border-b-2 border-emerald-700 font-semibold text-emerald-700" : "text-slate-500"}`}
        >
          Debt
        </button>
        <EntryDialog key={tab} type={tab} />
      </div>
      {tab === "bills" ? (
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Due This Month" value={remaining + paidTotal} />
          <Stat label="Paid This Month" value={paidTotal} />
          <Stat label="Remaining" value={remaining} />
          <div className="md:col-span-3 rounded-2xl border bg-white">
            {bills.length ? (
              bills.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap justify-between gap-3 border-b p-5"
                >
                  <div>
                    <strong>{b.name}</strong>
                    <p className="text-sm text-slate-500">
                      Due day {b.dueDay} · Monthly
                    </p>
                  </div>
                  <div className="text-right">
                    <strong>{rupiah(b.amount)}</strong>
                    <div className="mt-2 flex gap-2">
                      {paidBillIds.includes(b.id) ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                          Paid
                        </span>
                      ) : b.isActive ? (
                        <MutationForm action={markBillPaid}>
                          <input name="id" type="hidden" value={b.id} />
                          <button className="text-sm text-emerald-700">
                            Mark Paid
                          </button>
                        </MutationForm>
                      ) : (
                        <span className="text-xs text-slate-500">Inactive</span>
                      )}
                      <DeleteConfirmation
                        id={b.id}
                        name={b.name}
                        action={deleteBill}
                        paymentHistory
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-10 text-center text-sm text-slate-500">
                No bills yet. Add recurring bills to track upcoming obligations.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Total Remaining Debt" value={total} />
            <Stat
              label="Monthly Payments"
              value={activeDebts.reduce(
                (sum, debt) => sum + debt.installmentAmount,
                0,
              )}
            />
            <Stat label="Active Debts" value={activeDebts.length} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {!debts.length && (
              <p className="text-sm text-slate-500">
                No debts yet. Add a debt to track repayment.
              </p>
            )}
            {debts.map((d) => {
              const isPaidOff = isDebtPaidOff(d);
              const p = isPaidOff
                ? 100
                : progressPercent(
                    d.originalAmount - d.remainingAmount,
                    d.originalAmount,
                  );
              return (
                <article key={d.id} className="rounded-2xl border bg-white p-5">
                  <strong>{d.name}</strong>
                  {isPaidOff && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Paid Off
                    </span>
                  )}
                  <p className="mt-4 text-sm text-slate-500">Remaining</p>
                  <b className="text-2xl">
                    {rupiah(isPaidOff ? 0 : Math.max(0, d.remainingAmount))}
                  </b>
                  <p className="mt-2 text-sm">
                    {p}% paid · {rupiah(d.installmentAmount)}/month · Due{" "}
                    {d.dueDay}
                  </p>
                  <div className="mt-3 h-2 rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-emerald-600"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  {!isPaidOff && <PaymentDialog debt={d} />}
                  <div className="mt-3">
                    <DeleteConfirmation
                      id={d.id}
                      name={d.name}
                      action={deleteDebt}
                      paymentHistory
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
function EntryDialog({ type }: { type: "bills" | "debt" }) {
  const [open, setOpen] = useState(false);
  const action = type === "bills" ? createBill : createDebt;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ml-auto mb-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          + Add {type === "bills" ? "Bill" : "Debt"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Add {type === "bills" ? "Bill" : "Debt"}
          </DialogTitle>
        </DialogHeader>
        <MutationForm action={action} onSuccess={() => setOpen(false)}>
          <label className="mt-3 block text-sm">
            {type === "bills" ? "Bill name" : "Debt name"}
            <input
              name="name"

              className="w-full rounded-lg border p-2"
              required
            />
          </label>
          {type === "bills" ? (
            <>
              <label className="mt-3 block text-sm">
                Amount
                <input
                  name="amount"
                  type="number"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                  min="1"
                  max={2147483647}
                />
              </label>
              <label className="mt-3 block text-sm">
                Due day
                <input
                  name="dueDay"
                  type="number"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                  min="1"
                  max="31"
                />
              </label>
              <label className="mt-3 block text-sm">
                Category
                <input
                  name="category"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                />
              </label>
              <label className="mt-3 block text-sm">
                Notes
                <input
                  name="notes"

                  className="mt-3 w-full rounded-lg border p-2"
                />
              </label>
            </>
          ) : (
            <>
              <label className="mt-3 block text-sm">
                Lender
                <input
                  name="lender"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                />
              </label>
              <label className="mt-3 block text-sm">
                Original amount
                <input
                  name="originalAmount"
                  type="number"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                  min="1"
                  max={2147483647}
                />
              </label>
              <label className="mt-3 block text-sm">
                Remaining amount
                <input
                  name="remainingAmount"
                  type="number"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                  min="1"
                  max={2147483647}
                />
              </label>
              <label className="mt-3 block text-sm">
                Monthly payment
                <input
                  name="installmentAmount"
                  type="number"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                  min="1"
                  max={2147483647}
                />
              </label>
              <label className="mt-3 block text-sm">
                Due day
                <input
                  name="dueDay"
                  type="number"

                  className="mt-3 w-full rounded-lg border p-2"
                  required
                  min="1"
                  max="31"
                />
              </label>
            </>
          )}
          <DialogFooter>
            <DialogClose
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancel
            </DialogClose>
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              Save {type === "bills" ? "Bill" : "Debt"}
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
function PaymentDialog({ debt }: { debt: Debt }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="mt-4 text-sm text-emerald-700">
          Record Payment
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Record Payment
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {debt.name} · Remaining {rupiah(debt.remainingAmount)}
          </p>
        </DialogHeader>
        <MutationForm
          action={recordDebtPayment}
          onSuccess={() => setOpen(false)}
        >
          <input name="id" type="hidden" value={debt.id} />
          <label className="mt-3 block text-sm">
            Payment amount
            <input
              name="amount"
              type="number"
              min="1"

              className="w-full rounded-lg border p-2"
              required
              max={2147483647}
            />
          </label>
          <DialogFooter>
            <DialogClose
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancel
            </DialogClose>
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              Record Payment
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <strong className="mt-2 block text-2xl">
        {label === "Active Debts" ? value : rupiah(value)}
      </strong>
    </div>
  );
}
