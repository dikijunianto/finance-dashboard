import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { billPayments, bills, budgets, cfoNotes, debts, expenses, financeAccounts, goals, income, monthlySnapshots, paydayAllocations, paydayPlans } from "@/db/schema";
import { calculateDailySafeToSpend, calculateMonthlySurplus, calculateSafeToSpend, calculateSavingRate, financialStatus } from "@/lib/finance/calculations";
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
const monthStart = `${month}-01`;
const [year, monthNumber] = month.split("-").map(Number);
const nextMonthStart = `${monthNumber === 12 ? year + 1 : year}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, "0")}-01`;
export async function getDashboardData() {
  const [accounts, payments, activeBills, activeDebts, currentIncome, currentExpenses, currentBudget, snapshots, plans, notes] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.isActive, true)), db.select().from(billPayments).where(and(gte(billPayments.billingMonth, monthStart), lt(billPayments.billingMonth, nextMonthStart))), db.select().from(bills).where(eq(bills.isActive, true)), db.select().from(debts).where(eq(debts.status, "active")), db.select().from(income).where(and(gte(income.receivedAt, monthStart), lt(income.receivedAt, nextMonthStart))), db.select().from(expenses).where(and(gte(expenses.spentAt, monthStart), lt(expenses.spentAt, nextMonthStart))), db.select().from(budgets).where(and(gte(budgets.month, monthStart), lt(budgets.month, nextMonthStart))), db.select().from(monthlySnapshots).orderBy(desc(monthlySnapshots.month)).limit(6), db.select().from(paydayPlans).orderBy(desc(paydayPlans.payday)).limit(1), db.select().from(cfoNotes).orderBy(desc(cfoNotes.createdAt)).limit(4),
  ]);
  const cashAvailable = sum(accounts.filter(a => ["bank", "cash", "e_wallet"].includes(a.type)).map(a => a.balance));
  const unpaid = payments.filter(p => p.status !== "paid");
  const unpaidTotal = sum(unpaid.map(p => p.amount));
  const monthlyIncome = sum(currentIncome.map(row => row.amount));
  const monthlyOutflow = sum(currentExpenses.map(row => row.amount)) + sum(payments.filter(p => p.status === "paid").map(p => p.amount));
  const surplus = calculateMonthlySurplus(monthlyIncome, monthlyOutflow);
  const savings = sum(currentBudget.filter(b => b.category === "savings").map(b => b.allocatedAmount));
  const plan = plans[0]; const allocations = plan ? await db.select().from(paydayAllocations).where(eq(paydayAllocations.paydayPlanId, plan.id)) : [];
  const allocation = (category: string) => sum(allocations.filter(a => a.category === category).map(a => a.amount));
  const next = plan ? new Date(`${plan.nextPayday}T00:00:00+07:00`) : null; const days = next ? Math.max(0, Math.ceil((next.getTime() - Date.now()) / 86400000)) : 0;
  const safeInput = { cash: cashAvailable, unpaidBills: unpaidTotal, debtPayments: allocation("debt"), essentials: Math.max(0, allocation("essential") - sum(currentExpenses.filter(e => e.category === "essential").map(e => e.amount))), savings: allocation("savings"), investments: allocation("investments"), buffer: plan?.emergencyBuffer ?? 0, days };
  const safe = calculateSafeToSpend(safeInput);
  return { month, cashAvailable, bills: { unpaidTotal, unpaidCount: unpaid.length }, debtTotal: sum(activeDebts.map(d => d.remainingAmount)), debtCount: activeDebts.length, surplus, savingRate: calculateSavingRate(savings, monthlyIncome), safe, dailySafe: calculateDailySafeToSpend(safeInput), days, status: financialStatus(surplus, safe), cashFlow: [{ month, income: monthlyIncome, expenses: monthlyOutflow }], netWorth: snapshots.reverse().map(s => ({ month: s.month.slice(0, 7), value: s.netWorth })), budget: currentBudget.map(b => ({ name: b.category, value: b.allocatedAmount })), billsList: unpaid.slice(0, 5).map(p => ({ ...p, name: activeBills.find(b => b.id === p.billId)?.name ?? "Tagihan" })), debts: activeDebts.slice(0, 5), allocations, notes };
}
