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
import { formatDate } from "@/lib/dates";

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

type Movement = {
  id: string;
  accountId: string;
  amount: number;
  description: string;
  date: string;
  type: string;
};
export function AccountsPage({
  accounts,
  movements,
}: {
  accounts: Account[];
  movements: Movement[];
}) {
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
      <div className="mt-8 grid overflow-hidden rounded-2xl border bg-white lg:grid-cols-[1.6fr_1fr]">
        <section className="cash-hero border-0 p-6 md:p-8">
          <p className="eyebrow">Your everyday money</p>
          <h2 className="mt-6 text-sm text-muted">Liquid Cash</h2>
          <p className="mt-2 hero-amount">{rupiah(liquid)}</p>
          <p className="mt-3 text-sm text-muted">
            Active bank, cash and e-wallet accounts
          </p>
        </section>
        <div className="divide-y px-6">
          <Metric
            label="Investments"
            value={rupiah(investments)}
            caption="Active investment accounts; excluded from liquid cash"
          />
          <Metric
            label="Active Accounts"
            value={String(
              accounts.filter((account) => account.isActive).length,
            )}
            caption={`${accounts.length} accounts recorded, including inactive`}
          />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Transactions and payments update your balances. Reconcile against your
        bank or wallet when needed.
      </p>
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
                  <h2 className="eyebrow mb-3">{group.title}</h2>
                  <div className="overflow-hidden rounded-2xl border bg-white divide-y">
                    {accounts
                      .filter((account) => group.types.includes(account.type))
                      .map((account) => (
                        <article
                          key={account.id}
                          data-account-type={account.type}
                          className={`min-w-0 p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-8 ${account.isActive ? "" : "muted-record"}`}
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
                          <p className="mt-1 text-sm text-slate-500 lg:col-start-1">
                            {accountTypeLabel(account.type)}
                            {account.institution
                              ? ` · ${account.institution}`
                              : ""}
                          </p>
                          <p className="mt-5 text-xs text-slate-500 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:text-right">
                            Current Balance
                          </p>
                          <p className="mt-1 money lg:col-start-2 lg:row-start-2 lg:text-right">
                            {rupiah(account.balance)}
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-3 lg:col-span-2 lg:justify-end">
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
                          <details className="mt-4 border-t pt-3 lg:col-span-2">
                            <summary className="cursor-pointer text-sm text-brand">
                              Recent movements
                            </summary>
                            <div className="mt-3 divide-y">
                              {movements
                                .filter((m) => m.accountId === account.id)
                                .slice(0, 8)
                                .map((m) => (
                                  <div
                                    key={m.id}
                                    className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                                  >
                                    <div>
                                      <p>{m.description}</p>
                                      <p className="mt-1 text-xs text-muted">
                                        {formatDate(m.date)} ·{" "}
                                        {m.type.replaceAll("_", " ")}
                                      </p>
                                    </div>
                                    <strong>
                                      {m.amount < 0 ? "− " : "+ "}
                                      {rupiah(Math.abs(m.amount))}
                                    </strong>
                                  </div>
                                ))}
                            </div>
                          </details>
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
  const [actual, setActual] = useState(String(account.balance));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setActual(String(account.balance));
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={primary}>
          Reconcile Balance
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconcile Balance</DialogTitle>
        </DialogHeader>
        <p className="font-semibold">{account.name}</p>
        <p className="mt-3 text-sm text-slate-500">Recorded Balance</p>
        <p className="mt-1 text-xl font-semibold">{rupiah(account.balance)}</p>
        <MutationForm
          action={updateAccountBalance}
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="id" value={account.id} />
          <label className="mt-4 block text-sm">
            Actual Balance
            <input
              name="balance"
              type="number"
              min={-2147483648}
              max={2147483647}
              step="1"
              value={actual}
              onChange={(event) => setActual(event.target.value)}
              required
              className={input}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Enter whole Rupiah. Negative balances can represent overdrafts.
          </p>
          <p className="mt-4 text-sm">
            Adjustment:{" "}
            <strong>
              {actual.trim() && Number.isFinite(Number(actual))
                ? rupiah(Number(actual) - account.balance)
                : "—"}
            </strong>
          </p>
          <label className="mt-4 block text-sm">
            Notes (optional)
            <input name="notes" maxLength={1000} className={input} />
          </label>
          <DialogFooter>
            <DialogClose
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancel
            </DialogClose>
            <button type="submit" className={primary}>
              Reconcile
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
    <section className="min-w-0 py-6">
      <h2 className="text-sm text-slate-500">{label}</h2>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
    </section>
  );
}
