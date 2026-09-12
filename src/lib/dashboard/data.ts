import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  billPayments,
  bills,
  cfoNotes,
  financeAccounts,
  monthlySnapshots,
} from "@/db/schema";
import {
  allocationLabels,
  calculateSafeToSpend,
  financialStatus,
} from "@/lib/finance/calculations";
import { billDueDate, currentMonth, formatDate } from "@/lib/dates";
import { getMonthlyReport } from "@/lib/reports/monthly-report";
import { requireAuth } from "@/lib/auth/require-auth";
import { isLiquidAccount } from "@/lib/accounts";
export async function getDashboardData() {
  await requireAuth();
  const now = new Date();
  const { month, start, next } = currentMonth(now);
  const [report, accounts, payments, activeBills, snapshots, notes] =
    await Promise.all([
      getMonthlyReport(now),
      db
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.isActive, true)),
      db
        .select()
        .from(billPayments)
        .where(
          and(
            gte(billPayments.billingMonth, start),
            lt(billPayments.billingMonth, next),
          ),
        ),
      db.select().from(bills).where(eq(bills.isActive, true)),
      db
        .select()
        .from(monthlySnapshots)
        .orderBy(desc(monthlySnapshots.month))
        .limit(6),
      db.select().from(cfoNotes).orderBy(desc(cfoNotes.createdAt)).limit(4),
    ]);
  const liquid = accounts.filter(isLiquidAccount);
  const cashAvailable = liquid.reduce((n, a) => n + a.balance, 0);
  const paidIds = new Set(
    payments.filter((p) => p.status === "paid").map((p) => p.billId),
  );
  const unpaid = activeBills
    .filter((b) => !paidIds.has(b.id))
    .sort((a, b) => a.dueDay - b.dueDay);
  const unpaidTotal = unpaid.reduce((n, b) => n + Math.max(0, b.amount), 0);
  const allocated = Object.values(report.allocations).reduce(
    (a, b) => a + b,
    0,
  );
  const budget = Object.entries(report.allocations).map(([key, value]) => ({
    name: Object.hasOwn(allocationLabels, key) ? allocationLabels[key] : key,
    value,
  }));
  const remainingInstallments = report.activeDebts.reduce(
    (n, d) =>
      n +
      Math.max(
        0,
        Math.min(
          d.remainingAmount,
          d.installmentAmount -
            report.debtPayments
              .filter((p) => p.debtId === d.id)
              .reduce((paid, p) => paid + p.amount, 0),
        ),
      ),
    0,
  );
  const safe = calculateSafeToSpend({
    cash: cashAvailable,
    unpaidBills: unpaidTotal,
    debtPayments: remainingInstallments,
    essentials: Math.max(
      0,
      (report.allocations.living ?? 0) -
        report.categories
          .filter(([category]) => ["living", "essential"].includes(category))
          .reduce((n, [, amount]) => n + amount, 0),
    ),
    savings: report.allocations.savings ?? 0,
    investments: report.allocations.investments ?? 0,
    buffer: report.allocations.buffer ?? 0,
    days: 0,
  });
  return {
    month,
    cashAvailable,
    hasAccounts: liquid.length > 0,
    bills: { unpaidTotal, unpaidCount: unpaid.length },
    debtTotal: report.debtRemaining,
    debtCount: report.activeDebts.length,
    surplus: report.net,
    savingRate: report.savingRate,
    safe,
    status: financialStatus(report.net, safe),
    cashFlow: report.transactionCount
      ? [{ month, income: report.income, expenses: report.expenses }]
      : [],
    netWorth: snapshots
      .reverse()
      .map((s) => ({ month: s.month.slice(0, 7), value: s.netWorth })),
    budget: budget.filter((b) => b.value > 0),
    billsList: unpaid.slice(0, 5).map((b) => ({
      ...b,
      dueDate: formatDate(billDueDate(month, b.dueDay)),
      status: "unpaid",
    })),
    plan: {
      income: report.income,
      allocated,
      remaining: report.income - allocated,
    },
    notes,
    goals: report.goalRows.sort((a, b) => b.priority - a.priority).slice(0, 3),
  };
}
