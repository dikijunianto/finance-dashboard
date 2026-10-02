import { planCategories, isPlanCategory, type PlanCategory } from "../plan-categories";
export function calculatePlanUsage(input: {
  hasPlan: boolean;
  allocations: Record<string, number>;
  expenses: { amount: number; planCategory: string | null }[];
  paidBills: number;
  debtPayments: number;
  transfers: { amount: number; planCategory: string }[];
  cash: number;
  unpaidObligations: number;
}) {
  const usage = Object.fromEntries(planCategories.map(c => [c, 0])) as Record<PlanCategory, number>;
  let uncategorizedCount = 0;
  for (const row of input.expenses) {
    if (isPlanCategory(row.planCategory)) usage[row.planCategory] += row.amount;
    else uncategorizedCount++;
  }
  usage.bills_debt += input.paidBills + input.debtPayments;
  for (const row of input.transfers) {
    if (row.planCategory === "savings" || row.planCategory === "investments") usage[row.planCategory] += row.amount;
  }
  const remaining = Object.fromEntries(planCategories.map(c => [c, Math.max((input.allocations[c] ?? 0) - usage[c], 0)])) as Record<PlanCategory, number>;
  const overage = Object.fromEntries(planCategories.map(c => [c, Math.max(usage[c] - (input.allocations[c] ?? 0), 0)])) as Record<PlanCategory, number>;
  // The same bill/debt commitment is protected once, using the greater reserve.
  const protectedBillsDebt = Math.max(remaining.bills_debt, input.unpaidObligations);
  const safeToSpend = input.hasPlan ? input.cash - protectedBillsDebt - remaining.living - remaining.savings - remaining.investments - remaining.buffer : null;
  return { usage, remaining, overage, protectedBillsDebt, safeToSpend, uncategorizedCount, totalUsed: Object.values(usage).reduce((a, b) => a + b, 0) };
}
