import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
    return next(specifier, context);
  }
});
import {
  currentMonth,
  jakartaDate,
  billDueDate,
  suggestedFundingMonth,
  monthStart,
} from "../src/lib/dates.ts";
const {
  allocationTotals,
  calculateMonthlySurplus,
  isDebtPaidOff,
  isGoalCompleted,
  progressPercent,
} = await import("../src/lib/finance/calculations.ts");
import { rupiah } from "../src/lib/currency.ts";
const { calculatePlanUsage } = await import("../src/lib/finance/plan-usage.ts");
test("actual Plan usage reserves remaining amounts once, excludes Lifestyle and unknown expenses", () => {
  const input = { hasPlan: true, allocations: { living: 10000000, investments: 5000000, bills_debt: 12000000, lifestyle: 3000000 }, expenses: [{ amount: 4000000, planCategory: 'living' }, { amount: 50000, planCategory: null }], paidBills: 438000, debtPayments: 6987699, transfers: [{ amount: 5000000, planCategory: 'investments' }], cash: 12318350, unpaidObligations: 4600000 };
  const result = calculatePlanUsage(input);
  assert.equal(result.remaining.living, 6000000);
  assert.equal(result.remaining.investments, 0);
  assert.equal(result.usage.bills_debt, 7425699);
  assert.equal(result.protectedBillsDebt, 4600000);
  assert.equal(result.safeToSpend, 1718350);
  assert.equal(result.uncategorizedCount, 1);
  assert.equal(calculatePlanUsage({ ...input, hasPlan: false }).safeToSpend, null);
  const over = calculatePlanUsage({ ...input, allocations: { living: 1000000 } });
  assert.equal(over.remaining.living, 0);
  assert.equal(over.overage.living, 3000000);
  const categoryEdit = calculatePlanUsage({ ...input, expenses: [{ amount: 100000, planCategory: 'lifestyle' }] });
  assert.equal(categoryEdit.usage.living, 0);
  assert.equal(categoryEdit.usage.lifestyle, 100000);
});
test("funding suggestions follow approved cutoff and never shift dates", () => {
  for (const [date, expected] of [
    ["2026-09-24", "2026-09-01"],
    ["2026-09-25", "2026-10-01"],
    ["2026-09-28", "2026-10-01"],
    ["2026-09-30", "2026-10-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-29", "2028-03-01"],
    ["2026-02-22", "2026-02-01"],
  ])
    assert.equal(suggestedFundingMonth(date), expected);
  assert.equal(monthStart("2026-10"), "2026-10-01");
  assert.equal(monthStart("2026-13"), null);
});

test("Jakarta month boundaries and real month-end due dates", () => {
  assert.equal(jakartaDate(new Date("2026-09-30T17:00:00Z")), "2026-10-01");
  assert.deepEqual(currentMonth(new Date("2026-12-31T17:00:00Z")), {
    month: "2027-01",
    start: "2027-01-01",
    next: "2027-02-01",
  });
  assert.equal(currentMonth(new Date("2026-09-30T16:59:59Z")).month, "2026-09");
  assert.equal(billDueDate("2026-02", 31), "2026-02-28");
  assert.equal(billDueDate("2028-02", 31), "2028-02-29");
  assert.equal(billDueDate("2026-09", 31), "2026-09-30");
});
test("paid status and zero balances agree; progress is finite and clamped", () => {
  for (const remainingAmount of [0, -1])
    assert.equal(isDebtPaidOff({ remainingAmount, status: "active" }), true);
  for (const status of ["paid", "completed"])
    assert.equal(isDebtPaidOff({ remainingAmount: 10, status }), true);
  assert.equal(isDebtPaidOff({ remainingAmount: 10, status: "active" }), false);
  assert.equal(
    isGoalCompleted({
      currentAmount: 1,
      targetAmount: 10,
      status: "completed",
    }),
    true,
  );
  assert.equal(
    isGoalCompleted({ currentAmount: 1, targetAmount: 10, status: "active" }),
    false,
  );
  assert.equal(progressPercent(0, 0), 100);
  assert.equal(progressPercent(-5, 10), 0);
  assert.equal(progressPercent(15, 10), 100);
  assert.equal(progressPercent(5, 10), 50);
});
test("allocations retain duplicate and legacy categories; signed cash flow and IDR stay consistent", () => {
  const values = allocationTotals([
    { category: "savings", allocatedAmount: 10 },
    { category: "savings", allocatedAmount: 20 },
    { category: "legacy", allocatedAmount: 7 },
  ]);
  assert.deepEqual({ ...values }, { savings: 30, legacy: 7 });
  assert.equal(
    Object.getPrototypeOf(values),
    Object.prototype,
    "Plan props must be serializable plain objects",
  );
  assert.equal(
    allocationTotals([{ category: "constructor", allocatedAmount: 9 }])
      .constructor,
    9,
  );
  assert.equal(
    Object.values(values).reduce((a, b) => a + b, 0),
    37,
  );
  assert.equal(calculateMonthlySurplus(100, 120), -20);
  assert.equal(rupiah(1250000).replace(/\s/g, " "), "Rp 1.250.000");
});
