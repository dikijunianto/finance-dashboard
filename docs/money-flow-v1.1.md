# Money flow v1.1

`finance_accounts.balance` remains the current signed integer Rupiah balance.
Every new balance change writes `account_movements` in the same Drizzle transaction.
Ledger amounts use integer `bigint` because a reconciliation between the existing
minimum and maximum account balances can exceed a signed 32-bit delta. No floats
or cents are stored. Negative account balances remain supported.

## Migration and rollout

`0003_account_movements.sql` adds the ledger and nullable payment account links.
It does not update any existing balance, transaction, or payment. Inside the
migration transaction it locks accounts and writes one opening baseline for each
existing account, including inactive and zero-balance accounts. Old income/expense
account links are not evidence of a previous balance effect; only ledger entries
prove an applied effect. Historical payments stay unlinked.

Pause finance writes during migration and deployment. Apply the migration once,
using the migration runner/journal appropriate to the existing installation, then
deploy v1.1 before reopening writes. The previous version understands the added
columns but cannot maintain the new ledger, so mixed writable versions are not a
supported rollout. This change has not applied any production migration.

For rollback, keep finance writes paused and retain the additive ledger/schema.
Do not drop the ledger or replay history. Reconcile any new movements before
returning to an older writable version; prefer a forward fix. No destructive down
migration is provided because it would remove the audit history.

## Behavior

- Opening balances and reconciliation are not income. A zero adjustment is
  recorded too, so retried reconciliation has a durable request marker.
- New income/expenses require an active owned account. Edits reverse the previous
  ledger-backed effect, then apply the replacement. Deletes reverse the net effect
  and retain the ledger. Editing a legacy record explicitly links and applies its
  full updated amount; deleting an unlinked record never changes balances.
- Transfers have paired ledger entries with a shared reference, without a separate
  transfer table. Create and Revert are supported; editing is deferred. Revert is
  atomic and repeat-safe, including when an account has since become inactive.
- Bill payment retains the bill/month duplicate guard. Debt payment retains row
  locking, capped payment amounts and paid-off protection. Both require an account.
- There is no independent payment-history deletion UI. Existing whole-bill/debt
  deletion refunds linked payments atomically, keeps audit reversals and then
  deletes the domain/history rows. The confirmation explains this. Legacy payments
  have no ledger-backed account effect and are not refunded.
- Forms retain a request UUID on uncertain retries. The ledger's unique owner/
  request index and payload hash prevent duplicate effects or reuse with different
  input. Multi-account writes lock accounts in UUID order; creation uses a native
  per-request advisory lock before the account exists.
- Plan and Goals never move actual balances. Reports continue to analyze the
  existing source tables; transfers, openings, reversals and adjustments cannot
  inflate income/expense. Overview uses the existing liquid account and Safe to
  Spend calculations.

## Local verification

Use only a guarded `QA_DATABASE_URL` on localhost and the `myfinance_qa` database.
Run `tests/setup-local.mjs`, `tests/migration-local.mjs`, `tests/actions-local.mjs`, `tests/finance.test.mjs`,
and `tests/browser-local.mjs` against `tests/start-local.mjs`. The setup checks that
the migration leaves balances intact and that baselines sum correctly. Action
tests exercise ledger sums, legacy rows, concurrent writes, retries, reversals,
payment refunds and forced ledger-insert rollback. Test fixtures are isolated;
production Neon is never used.
