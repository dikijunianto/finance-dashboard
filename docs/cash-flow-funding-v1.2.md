# Cash flow and Plan funding v1.2

Actual cash flow uses receipt/payment dates, not the planning month:

- Income: income rows only.
- Spending: manual expense rows plus paid bill payments.
- Cash Outflow: Spending plus entire debt payments.
- Net Cash Flow: Income minus Cash Outflow.
- Opening balances, transfers, adjustments and audit reversals are excluded.

Pay Bill does not create an expense row, so bill payments contribute exactly
once. Spending categories reuse the bill category. Debt payments remain visible
in Debt Progress but never enter Spending Breakdown. Reports, Overview and
Activity summaries use `getMonthlyReport`; Activity displays each payment and
each paired transfer as one logical event, including legacy unlinked payments.
Paid legacy bills with no recorded payment date remain visible in Activity as
undated history; they are not assigned a guessed month in actual cash-flow reports.

## Funding metadata

Migration `0004_smart_timeslip.sql` adds nullable `income.funding_month` as a
PostgreSQL DATE. Backfill assigns the first day of each existing receipt month;
no account, ledger, payment, debt, goal or allocation is changed. No historical
salary is guessed to belong to the following month.

Null remains accepted for older writers. Plan queries fall back to the receipt
month for null funding metadata. New UI writes an explicit first-of-month date;
older action callers without the new field retain same-month behavior.

The income dialog suggests the next month from the final six calendar dates,
following the approved examples: September 24 stays September, September 25
onward suggests October. December rolls to January and leap months are handled.
Suggestions follow date edits only until the user overrides the funding month.
Editing existing income preserves its assigned month until explicitly changed.

Funding-only edits update metadata without creating account movements, reversing
old effects or changing balances/dates. Legacy unlinked income can keep its
account empty for metadata edits; changing its amount/date requires explicitly
selecting an account. Inactive existing accounts can remain selected for
metadata-only income edits; actual money changes still require an active account.

Plan and Reports offer a native month selector. Plan's funding list shows actual
receipt dates. Allocations and Goals remain planning/tracking only. Overview's
Plan summary uses assigned funding; Cash Available and Safe-to-Spend retain their
existing account classification and planning formula.

## Rollout and rollback

No production migration, push or deployment has been performed. Resolve the
previous production schema/Drizzle-journal gate before any rollout. Use the
existing `pnpm db:migrate` command with the verified target, never manual replay
of migrations. Apply additive schema before new readers; v1.2 cannot query the
old schema. Retain metadata on rollback: v1.1 ignores this column and preserves
balances, but its Plan/Reports semantics differ. Keep the v1.1 ledger rollout
precautions when migrating from a pre-ledger release.

## Local proof

Run `tests/setup-local.mjs`, `tests/migration-local.mjs`,
`tests/actions-local.mjs`, `tests/finance.test.mjs`, `tests/browser-local.mjs`
and `tests/browser-v12-local.mjs` against the isolated local PostgreSQL QA setup.
The new scenario verifies a September 30 salary funding October, unchanged
ledger on funding edits, spending/outflow separation, payment deduplication,
transfer exclusion, override behavior and refresh persistence.
