import { and, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  budgets,
  debtPayments,
  debts,
  expenses,
  goals,
  income,
} from "@/db/schema";
import {
  allocationTotals,
  calculateMonthlySurplus,
  calculateSavingRate,
  isDebtPaidOff,
  isGoalCompleted,
} from "@/lib/finance/calculations";
import { currentMonth } from "@/lib/dates";
import { requireAuth } from "@/lib/auth/require-auth";
export async function getMonthlyReport(now = new Date()) {
  await requireAuth();
  const { month, start, next } = currentMonth(now);
  const [incomes, expenseRows, plans, payments, debtRows, goalRows] =
    await Promise.all([
      db
        .select()
        .from(income)
        .where(and(gte(income.receivedAt, start), lt(income.receivedAt, next))),
      db
        .select()
        .from(expenses)
        .where(and(gte(expenses.spentAt, start), lt(expenses.spentAt, next))),
      db
        .select()
        .from(budgets)
        .where(and(gte(budgets.month, start), lt(budgets.month, next))),
      db
        .select()
        .from(debtPayments)
        .where(
          and(gte(debtPayments.paidAt, start), lt(debtPayments.paidAt, next)),
        ),
      db.select().from(debts),
      db.select().from(goals),
    ]);
  const total = (rows: { amount: number }[]) =>
    rows.reduce((n, r) => n + r.amount, 0);
  const incomeTotal = total(incomes),
    expensesTotal = total(expenseRows);
  const allocations = allocationTotals(plans);
  const activeDebts = debtRows.filter((d) => !isDebtPaidOff(d));
  return {
    month,
    income: incomeTotal,
    expenses: expensesTotal,
    net: calculateMonthlySurplus(incomeTotal, expensesTotal),
    savingRate: calculateSavingRate(allocations.savings ?? 0, incomeTotal),
    allocations,
    transactionCount: incomes.length + expenseRows.length,
    categories: Object.entries(
      expenseRows.reduce<Record<string, number>>(
        (a, e) => {
          a[e.category] = (a[e.category] ?? 0) + e.amount;
          return a;
        },
        Object.create(null) as Record<string, number>,
      ),
    ),
    debtPaid: total(payments),
    debtPayments: payments,
    debtRemaining: activeDebts.reduce(
      (n, d) => n + Math.max(0, d.remainingAmount),
      0,
    ),
    activeDebts,
    goalRows,
    activeGoals: goalRows.filter((g) => !isGoalCompleted(g)).length,
    completedGoals: goalRows.filter(isGoalCompleted).length,
  };
}
