import assert from "node:assert/strict";
import test from "node:test";
import { currentMonth, jakartaDate, billDueDate } from "../src/lib/dates.ts";
import {
  allocationTotals,
  calculateMonthlySurplus,
  isDebtPaidOff,
  isGoalCompleted,
  progressPercent,
} from "../src/lib/finance/calculations.ts";
import { rupiah } from "../src/lib/currency.ts";

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
