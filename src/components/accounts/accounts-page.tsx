"use client";
import { useState } from "react";
import {
  createAccount,
  updateAccount,
  updateAccountBalance,
  deactivateAccount,
} from "@/actions/accounts";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { MutationForm } from "@/components/ui/mutation-form";
import {
  accountTypes,
  accountTypeLabel,
  isLiquidAccount,
} from "@/lib/accounts";
import { rupiah } from "@/lib/currency";

type Account = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  balance: number;
  isActive: boolean;
};
const primary =
  "rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white";
const input = "mt-1 w-full rounded-lg border p-2";

export function AccountsPage({ accounts }: { accounts: Account[] }) {
  const liquid = accounts
    .filter(isLiquidAccount)
    .reduce((sum, account) => sum + account.balance, 0);
  const investments = accounts
    .filter((account) => account.isActive && account.type === "investment")
    .reduce((sum, account) => sum + account.balance, 0);
  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Accounts</h1>
          <p className="mt-2 text-slate-600">
            Track your current balances across bank accounts, cash, and wallets.
          </p>
        </div>
        <AccountDialog />
      </header>
      <p className="mt-4 text-sm text-slate-500">
        Balances are maintained manually. Recording income, expenses, or
        payments does not change these balances.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Liquid Cash"
          value={rupiah(liquid)}
          caption="Active bank, cash and e-wallet accounts"
        />
        <Metric
          label="Investments"
          value={rupiah(investments)}
          caption="Active investment accounts; excluded from liquid cash"
        />
        <Metric
          label="Total Accounts"
          value={String(accounts.length)}
          caption="Includes inactive accounts"
        />
      </div>
      {accounts.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="min-w-0 rounded-2xl border bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-semibold">{account.name}</h2>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${account.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {account.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {accountTypeLabel(account.type)}
              </p>
              {account.institution && (
                <p className="mt-1 break-words text-sm text-slate-500">
                  {account.institution}
                </p>
              )}
              <p className="mt-5 text-sm text-slate-500">Current Balance</p>
              <p className="mt-1 text-2xl font-semibold">
                {rupiah(account.balance)}
              </p>
              <div className="mt-5 flex flex-wrap items-start gap-3">
                <BalanceDialog account={account} />
                <AccountDialog account={account} />
                {account.isActive && (
                  <MutationForm action={deactivateAccount}>
                    <input name="id" type="hidden" value={account.id} />
                    <button
                      type="submit"
                      className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Deactivate
                    </button>
                  </MutationForm>
                )}
              </div>
              {!account.isActive && (
                <p className="mt-3 text-xs text-slate-500">
                  Excluded from active totals. Choose Edit to reactivate.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className="mt-6 rounded-2xl border bg-white p-6 text-center">
          <h2 className="text-lg font-semibold">No accounts yet</h2>
          <p className="mx-auto mt-2 mb-5 max-w-lg text-sm text-slate-500">
            Add your bank accounts, cash, or e-wallets so MyFinance can
            calculate your available cash.
          </p>
          <AccountDialog />
        </section>
      )}
    </div>
  );
}
function AccountDialog({ account }: { account?: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={account ? "rounded-xl border px-4 py-2 text-sm" : primary}
        >
          {account ? "Edit" : "+ Add Account"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>
        <MutationForm
          action={account ? updateAccount : createAccount}
          onSuccess={() => setOpen(false)}
        >
          {account && <input name="id" type="hidden" value={account.id} />}
          <label className="block text-sm">
            Account Name
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={account?.name ?? ""}
              className={input}
            />
          </label>
          <label className="mt-3 block text-sm">
            Type
            <select
              name="type"
              defaultValue={account?.type ?? "bank"}
              className={input}
            >
              {account &&
                !accountTypes.some((type) => type === account.type) && (
                  <option value={account.type}>
                    {account.type} (existing)
                  </option>
                )}
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {accountTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Institution (optional)
            <input
              name="institution"
              maxLength={120}
              defaultValue={account?.institution ?? ""}
              className={input}
            />
          </label>
          {account ? (
            <label className="mt-3 block text-sm">
              Status
              <select
                name="isActive"
                defaultValue={String(account.isActive)}
                className={input}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          ) : (
            <label className="mt-3 block text-sm">
              Current Balance
              <input
                name="balance"
                type="number"
                min={-2147483648}
                max={2147483647}
                step="1"
                required
                defaultValue="0"
                className={input}
              />
            </label>
          )}
          <DialogFooter>
            <DialogClose
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancel
            </DialogClose>
            <button type="submit" className={primary}>
              {account ? "Save Changes" : "Add Account"}
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
function BalanceDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={primary}>
          Edit Balance
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Balance</DialogTitle>
        </DialogHeader>
        <p className="font-semibold">{account.name}</p>
        <p className="mt-3 text-sm text-slate-500">Current Balance</p>
        <p className="mt-1 text-xl font-semibold">{rupiah(account.balance)}</p>
        <MutationForm
          action={updateAccountBalance}
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="id" value={account.id} />
          <label className="mt-4 block text-sm">
            New Balance
            <input
              name="balance"
              type="number"
              min={-2147483648}
              max={2147483647}
              step="1"
              defaultValue={account.balance}
              required
              className={input}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Enter whole Rupiah. Negative balances can represent overdrafts.
          </p>
          <DialogFooter>
            <DialogClose
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancel
            </DialogClose>
            <button type="submit" className={primary}>
              Update Balance
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
function Metric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <section className="min-w-0 rounded-2xl border bg-white p-5">
      <h2 className="text-sm text-slate-500">{label}</h2>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
    </section>
  );
}
