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
import { StatusBadge } from "@/components/ui/status-badge";

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
    <div className="page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Accounts</h1>
          <p className="mt-2 text-slate-600">
            Your current balances across cash, banks, wallets, and investments.
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
          label="Active Accounts"
          value={String(accounts.filter((account) => account.isActive).length)}
          caption={`${accounts.length} accounts recorded, including inactive`}
        />
      </div>
      {accounts.length ? (
        <div className="mt-7 space-y-6">
          {[
            { title: "Bank Accounts", types: ["bank"] },
            { title: "Cash & Wallets", types: ["cash", "e_wallet"] },
            { title: "Investments", types: ["investment"] },
            {
              title: "Other Accounts",
              types: accounts
                .filter(
                  (a) =>
                    !["bank", "cash", "e_wallet", "investment"].includes(
                      a.type,
                    ),
                )
                .map((a) => a.type),
            },
          ].map(
            (group) =>
              accounts.some((a) => group.types.includes(a.type)) && (
                <section key={group.title}>
                  <h2 className="mb-3 text-lg font-semibold">{group.title}</h2>
                  <div className="overflow-hidden rounded-2xl border bg-white divide-y">
                    {accounts
                      .filter((account) => group.types.includes(account.type))
                      .map((account) => (
                        <article
                          key={account.id}
                          className={`min-w-0 p-5 md:grid md:grid-cols-[1fr_auto] md:gap-x-8 ${account.isActive ? "" : "muted-record"}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-base font-semibold">
                              {account.name}
                            </h3>
                            <StatusBadge
                              tone={account.isActive ? "good" : "neutral"}
                            >
                              {account.isActive ? "Active" : "Inactive"}
                            </StatusBadge>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 md:col-start-1">
                            {accountTypeLabel(account.type)}
                          </p>
                          {account.institution && (
                            <p className="mt-1 break-words text-sm text-slate-500 md:col-start-1">
                              {account.institution}
                            </p>
                          )}
                          <p className="mt-5 text-xs text-slate-500 md:col-start-2 md:row-start-1 md:mt-0 md:text-right">
                            Current Balance
                          </p>
                          <p className="mt-1 money md:col-start-2 md:row-start-2 md:text-right">
                            {rupiah(account.balance)}
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-3 md:col-span-2 md:justify-end">
                            <BalanceDialog account={account} />
                            <AccountDialog account={account} />
                            {account.isActive && (
                              <MutationForm action={deactivateAccount}>
                                <input
                                  name="id"
                                  type="hidden"
                                  value={account.id}
                                />
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
                            <p className="mt-3 text-xs text-slate-500 md:col-span-2">
                              Excluded from active totals. Choose Edit to
                              reactivate.
                            </p>
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              ),
          )}
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
