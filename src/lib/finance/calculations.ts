export type SafeToSpendInput = {
  cash: number;
  unpaidBills: number;
  debtPayments: number;
  essentials: number;
  savings: number;
  investments: number;
  buffer: number;
  days: number;
};
export function calculateNetWorth(assets: number, debt: number) {
  return assets - debt;
}
export function calculateSavingRate(savings: number, income: number) {
  return income ? Math.round((savings / income) * 100) : 0;
}
export function calculateMonthlySurplus(income: number, expenses: number) {
  return income - expenses;
}
export function calculateSafeToSpend(input: SafeToSpendInput) {
  return (
    input.cash -
    input.unpaidBills -
    input.debtPayments -
    input.essentials -
    input.savings -
    input.investments -
    input.buffer
  );
}
export function calculateDailySafeToSpend(input: SafeToSpendInput) {
  return Math.max(
    0,
    Math.floor(calculateSafeToSpend(input) / Math.max(input.days, 1)),
  );
}
export function calculateRunway(safeToSpend: number, dailyExpenses: number) {
  return dailyExpenses
    ? Math.floor(Math.max(0, safeToSpend) / dailyExpenses)
    : 0;
}
export function financialStatus(surplus: number, safeToSpend: number) {
  return surplus < 0 || safeToSpend < 0
    ? { label: "Defisit", tone: "red" }
    : safeToSpend < 1_000_000
      ? { label: "Perlu Dijaga", tone: "amber" }
      : { label: "Aman", tone: "green" };
}

export function isDebtPaidOff(debt: {
  remainingAmount: number;
  status: string;
}) {
  return (
    debt.remainingAmount <= 0 || ["paid", "completed"].includes(debt.status)
  );
}
export function isGoalCompleted(goal: {
  currentAmount: number;
  targetAmount: number;
  status: string;
}) {
  return goal.currentAmount >= goal.targetAmount || goal.status === "completed";
}
export function progressPercent(current: number, target: number) {
  return target <= 0
    ? 100
    : Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}
export const allocationLabels: Record<string, string> = {
  bills_debt: "Bills & Debt",
  living: "Living Expenses",
  savings: "Savings",
  investments: "Investments",
  lifestyle: "Lifestyle",
  buffer: "Buffer",
};
export function allocationTotals(
  rows: { category: string; allocatedAmount: number }[],
) {
  return {
    ...rows.reduce<Record<string, number>>(
      (values, row) => {
        values[row.category] =
          (values[row.category] ?? 0) + row.allocatedAmount;
        return values;
      },
      Object.create(null) as Record<string, number>,
    ),
  };
}
