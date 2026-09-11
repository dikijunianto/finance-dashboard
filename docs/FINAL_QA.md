# Final local QA — 2026-09-12

Baseline: local commit `2dcbd30`. No push, deployment, PR, production migration, or production data write.

## Scope and findings

Reviewed Overview, Cash Flow, Bills & Debt, Plan, Goals, Reports, Settings, login/logout, protected layouts, all finance actions, formatting, and dialogs.

Fixed concrete defects:

- Paid bill totals now query current-month payments; paid bills stop appearing as unpaid.
- Debt cards, totals, Reports, and Overview share paid-off rules, including persisted paid/completed statuses.
- Debt payments and goal contributions lock their rows within the existing transactions to prevent concurrent lost updates. Goal metadata edits preserve saved progress.
- Reports and Overview share monthly income, expense, surplus, debt, and goal data. Cash Flow summaries explicitly show the same current month while retaining all historical transactions in the list.
- Plan totals include duplicate and legacy categories instead of silently overwriting/omitting them. Ambiguous duplicate rows cause a safe, rolled-back edit error; no rows are deleted or remapped.
- Month calculations run per request in Asia/Jakarta. Month-end bill dates clamp to the actual last day. Stale Plan forms cannot accidentally edit a new month.
- Forms share error/pending handling; success is shown only after the action completes. Failed submissions preserve input. Missing records and invalid input return safe errors.
- All entry/progress/delete dialogs use the existing Radix Dialog primitive, with Cancel, X, Escape, focus trapping/restoration, and viewport scrolling.
- Destructive actions identify their target and require confirmation. Payment-history deletion is disclosed.
- Mobile navigation works; default borders, empty chart cards, chart legends, labels, and long text are consistent. Removed decorative chart animation to keep displayed data stable.
- Login inputs no longer reset under a corrected retry after invalid credentials. Authentication architecture is unchanged.
- Missing account/history data is explicitly unavailable/empty, not fabricated. A safe page error boundary never replaces database errors with financial zeros.

## Cleanup and preservation

- Removed the custom Cash Flow modal, obsolete generic finance mutation branches, fake zero paid-bill metric, and unreferenced legacy validation schemas.
- `planner.ts` and workspace component names remain as compatibility code for Settings financial notes only. Notes no longer expose generic amount fields or “Your records”.
- `/payday` redirects to Plan. Existing payday tables/rows remain intact; old payday data is not silently converted into current-month income or allocations.
- `planner_items`, all finance tables, migration files, authentication tables, package dependencies, and lockfile remain unchanged.
- No production database was available for legacy-row inspection. No legacy rows were discarded or automatically mapped.
- No hardcoded financial balances remain in production UI. Calculation thresholds, chart colors, and test-only values are not financial data.

## Verification

Passed:

- Lint, production build, and standalone TypeScript check.
- Three native Node regression checks: Jakarta/month-end boundaries, paid/completed/clamped progress, signed amounts, duplicate/legacy allocation aggregation, and serializable Plan props.
- Real local PostgreSQL + Drizzle action checks: income/expense create/update/delete, paid-bill idempotency, concurrent debt payments and goal contributions, paid-off/completed guards, goal metadata preservation, stale/duplicate Plan rollback, and Overview/Reports agreement.
- Authentication checks on every finance action and aggregate read, tampered/no-expiry/wrong-algorithm session rejection, logout cookie expiry, and unavailable-database failure handling.
- Production-build browser smoke: invalid then valid login; create income/expense/bill/debt/goal/note; mark bill paid; partial/full debt repayment; Plan edits; goal completion; refresh persistence; confirmed deletion.
- Browser Cancel/X/Escape, clean reopen, focus trap/return, pending submit disabling, and failed-save recovery. Direct unauthenticated action replays produce no writes.
- Desktop 1440px, tablet 768px, mobile 375px across all main routes: navigation, no horizontal page overflow, dialogs fit viewport. Screenshots reviewed.
- Browser run completed without console or runtime warnings/errors.

Tests used a newly created, isolated local PostgreSQL container, never Neon. Action tests mock only Next request cookies/cache/redirect; browser tests exercise the actual production-built Next server.

## Reproduce locally

Use Node 24+ and a dedicated disposable local database named `myfinance_qa`. Never use real application data. The scripts reject remote database hosts and non-QA database names. Plan tests intentionally change allocations inside this isolated database.

The project retains its existing npm lockfile. In this environment the bundled pnpm 11 runner attempted an unsolicited install with unapproved dependency builds; the checks instead used pnpm 10.17.1, with dependencies restored from the unchanged lockfile.

```powershell
npm ci
npx --yes pnpm@10.17.1 lint
npx --yes pnpm@10.17.1 build
npx tsc --noEmit
node --test tests/finance.test.mjs

# Set QA_DATABASE_URL to your dedicated local PostgreSQL database.
node tests/setup-local.mjs
node tests/actions-local.mjs
node tests/start-local.mjs
# In another terminal, with QA_DATABASE_URL also set:
# Set QA_PLAYWRIGHT_MODULE to an installed Playwright module if not locally resolvable.
# Browser defaults to installed Edge; QA_BROWSER_CHANNEL can select another installed channel.
node tests/browser-local.mjs
```

Browser screenshots are written to an OS temporary directory printed by the test. Browser-created rows are removed only from the isolated test database. The local container can be stopped and retained for reuse.

## Known limits / follow-up

- Live Neon data, Vercel environment settings, and deployed behavior were deliberately not tested or changed.
- Existing duplicate Plan rows, if present, require an explicit data-reconciliation decision before that month's plan can be edited.
- Account balances are recorded account data, not automatically synchronized bank balances. Safe-to-Spend remains an estimate using known obligations and planned reserves; unmapped expense categories do not reduce the living reserve.
- Existing Cash Flow/Goal metadata update actions were tested directly; no new edit screens or product features were added.
- Production dependency audit: zero vulnerabilities. Full audit: four moderate development-only findings in the existing Drizzle Kit → esbuild dependency chain. No forced/breaking dependency upgrade was performed.
- Native Node TypeScript tests emit an informational module-type auto-detection warning; lint is clean. Package module architecture was not changed merely to suppress this warning.

**Not pushed or deployed.**
