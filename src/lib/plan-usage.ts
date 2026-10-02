import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { accountMovements, billPayments, bills, budgets, expenses, financeAccounts, transferPlanAttributions } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
import { currentMonth } from "@/lib/dates";
import { isLiquidAccount } from "@/lib/accounts";
import { getMonthlyReport } from "@/lib/reports/monthly-report";
import { getPlanFunding } from "@/lib/plan-funding";
import { calculatePlanUsage } from "@/lib/finance/plan-usage";
export async function getPlanUsage(now = new Date(), existingReport?: Awaited<ReturnType<typeof getMonthlyReport>>) {
  await requireAuth();
  const { start, next } = currentMonth(now);
  const [report, funding, expenseRows, planRows, accounts, activeBills, monthlyBills, movements, attributions] = await Promise.all([
    existingReport ?? getMonthlyReport(now), getPlanFunding(start),
    db.select().from(expenses).where(and(gte(expenses.spentAt, start), lt(expenses.spentAt, next))),
    db.select().from(budgets).where(and(gte(budgets.month, start), lt(budgets.month, next))),
    db.select().from(financeAccounts),
    db.select().from(bills).where(eq(bills.isActive, true)),
    db.select().from(billPayments).where(eq(billPayments.billingMonth, start)),
    // Reversals may occur in a later month: never restrict them to the selected month.
    db.select().from(accountMovements).where(eq(accountMovements.referenceType, "transfer")),
    db.select().from(transferPlanAttributions),
  ]);
  const paidIds = new Set(monthlyBills.filter(p => p.status === "paid").map(p => p.billId));
  const unpaidBills = activeBills.filter(b => !paidIds.has(b.id)).reduce((n, b) => n + Math.max(0, b.amount), 0);
  const unpaidDebt = report.activeDebts.reduce((n, d) => n + Math.max(0, Math.min(d.remainingAmount, d.installmentAmount - report.debtPayments.filter(p => p.debtId === d.id).reduce((sum, p) => sum + p.amount, 0))), 0);
  const reversed = new Set(movements.filter(m => m.type === "reversal").map(m => m.referenceId));
  const counted = new Set<string>();
  const transfers: { amount: number; planCategory: string }[] = [];
  for (const m of movements) {
    if (m.type !== "transfer_out" || m.occurredAt < start || m.occurredAt >= next || reversed.has(m.referenceId) || counted.has(m.referenceId)) continue;
    const attribution = attributions.find(a => a.id === m.referenceId && a.userId === m.userId);
    const pair = movements.find(p => p.referenceId === m.referenceId && p.userId === m.userId && p.type === "transfer_in" && p.amount === -m.amount);
    if (attribution && pair) {
      transfers.push({ amount: Math.max(0, -m.amount), planCategory: attribution.planCategory });
      counted.add(m.referenceId);
    }
  }
  return {
    funding, allocations: report.allocations, hasPlan: planRows.length > 0,
    ...calculatePlanUsage({
      hasPlan: planRows.length > 0,
      allocations: report.allocations,
      expenses: expenseRows,
      paidBills: report.billSpending,
      debtPayments: report.debtPaid,
      transfers,
      cash: accounts.filter(isLiquidAccount).reduce((n, a) => n + a.balance, 0),
      unpaidObligations: unpaidBills + unpaidDebt,
    }),
  };
}
