import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  budgets,
  bills,
  billPayments,
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
import { allocationLabels, isPlanCategory } from "@/lib/plan-categories";
export async function getMonthlyReport(now = new Date()) {
  await requireAuth();
  const { month, start, next } = currentMonth(now);
  const [incomes, expenseRows, plans, payments, debtRows, goalRows, paidBills] =
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
      db
        .select({ amount: billPayments.amount })
        .from(billPayments)
        .innerJoin(bills, eq(bills.id, billPayments.billId))
        .where(
          and(
            eq(billPayments.status, "paid"),
            gte(billPayments.paidAt, new Date(start + "T00:00:00+07:00")),
            lt(billPayments.paidAt, new Date(next + "T00:00:00+07:00")),
          ),
        ),
    ]);
  const total = (rows: { amount: number }[]) =>
    rows.reduce((n, r) => n + r.amount, 0);
  const incomeTotal = total(incomes),
    expensesTotal = total(expenseRows);
  const allocations = allocationTotals(plans);
  // Paying a bill creates no expense row: its payment is the canonical contribution.
  const billSpending = total(paidBills);
  const spending = expensesTotal + billSpending;
  const debtPaid = total(payments);
  const cashOutflow = spending + debtPaid;
  const activeDebts = debtRows.filter((d) => !isDebtPaidOff(d));
  return {
    month,
    income: incomeTotal,
    expenses: expensesTotal,
    manualSpending: expensesTotal,
    billSpending,
    spending,
    cashOutflow,
    net: calculateMonthlySurplus(incomeTotal, cashOutflow),
    savingRate: calculateSavingRate(allocations.savings ?? 0, incomeTotal),
    allocations,
    transactionCount:
      incomes.length + expenseRows.length + paidBills.length + payments.length,
    categories: Object.entries(
      [
        ...expenseRows.map((e) => ({
          amount: e.amount,
          category: isPlanCategory(e.planCategory)
            ? allocationLabels[e.planCategory]
            : "Uncategorized",
        })),
        ...paidBills.map((p) => ({
          amount: p.amount,
          category: allocationLabels.bills_debt,
        })),
      ].reduce<Record<string, number>>(
        (a, e) => {
          a[e.category] = (a[e.category] ?? 0) + e.amount;
          return a;
        },
        Object.create(null) as Record<string, number>,
      ),
    ).filter(([, amount]) => amount !== 0).sort(([, a], [, b]) => b - a),
    debtPaid,
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
