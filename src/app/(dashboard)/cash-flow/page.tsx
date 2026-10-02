import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accountMovements,
  expenses,
  financeAccounts,
  income,
  bills,
  billPayments,
  debts,
  debtPayments,
  transferPlanAttributions,
} from "@/db/schema";
import {
  CashFlowPage,
  type ActivityItem,
} from "@/components/cash-flow/cash-flow-page";
import { requireOwner } from "@/lib/action-result";
import { currentMonth, jakartaDate } from "@/lib/dates";
import { isPlanCategory } from "@/lib/plan-categories";
import { getMonthlyReport } from "@/lib/reports/monthly-report";
export default async function Page({ searchParams }: { searchParams: Promise<{ planCategory?: string }> }) {
  const requestedFilter = (await searchParams).planCategory;
  const userId = await requireOwner();
  const [
    incomes,
    expenseRows,
    accounts,
    movements,
    paidBills,
    paidDebts,
    summary,
    transferPlans,
  ] = await Promise.all([
    db
      .select()
      .from(income)
      .where(eq(income.userId, userId))
      .orderBy(desc(income.receivedAt)),
    db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.spentAt)),
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
    db
      .select()
      .from(accountMovements)
      .where(eq(accountMovements.userId, userId))
      .orderBy(
        desc(accountMovements.occurredAt),
        desc(accountMovements.createdAt),
      ),
    db
      .select({ payment: billPayments, name: bills.name })
      .from(billPayments)
      .innerJoin(bills, eq(bills.id, billPayments.billId))
      .where(eq(billPayments.userId, userId)),
    db
      .select({ payment: debtPayments, name: debts.name })
      .from(debtPayments)
      .innerJoin(debts, eq(debts.id, debtPayments.debtId))
      .where(eq(debtPayments.userId, userId)),
    getMonthlyReport(),
    db.select().from(transferPlanAttributions).where(eq(transferPlanAttributions.userId, userId)),
  ]);
  const name = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "Unlinked / legacy";
  const linked = (type: string, id: string) =>
    movements.some(
      (m) =>
        m.referenceType === type &&
        m.referenceId === id &&
        m.type !== "reversal",
    );
  const items: ActivityItem[] = [
    ...incomes.map((x) => ({
      id: x.id,
      label: x.source,
      amount: x.amount,
      date: x.receivedAt,
      notes: x.notes ?? "",
      category: "",
      type: "income" as const,
      accountId: x.accountId,
      context: linked("income", x.id) ? name(x.accountId) : "Unlinked / legacy",
      linked: linked("income", x.id),
      fundingMonth: x.fundingMonth ?? x.receivedAt.slice(0, 7) + "-01",
    })),
    ...expenseRows.map((x) => ({
      id: x.id,
      label: x.description,
      amount: x.amount,
      date: x.spentAt,
      notes: x.notes ?? "",
      category: x.category,
      planCategory: x.planCategory,
      type: "expense" as const,
      accountId: x.accountId,
      context: linked("expense", x.id)
        ? name(x.accountId)
        : "Unlinked / legacy",
      linked: linked("expense", x.id),
    })),
    ...paidBills
      .filter((x) => x.payment.status === "paid")
      .map((x) => ({
        id: x.payment.id,
        label: x.name,
        amount: -x.payment.amount,
        date: x.payment.paidAt ? jakartaDate(x.payment.paidAt) : "",
        notes: x.payment.paidAt
          ? ""
          : "Legacy payment — actual date not recorded.",
        category: "Bill Payment",
        planCategory: "bills_debt",
        type: "movement" as const,
        accountId: x.payment.accountId,
        context: name(x.payment.accountId),
        linked: !!x.payment.accountId,
      })),
    ...paidDebts.map((x) => ({
      id: x.payment.id,
      label: x.name,
      amount: -x.payment.amount,
      date: x.payment.paidAt,
      notes: x.payment.notes ?? "",
      category: "Debt Payment",
      planCategory: "bills_debt",
      type: "movement" as const,
      accountId: x.payment.accountId,
      context: name(x.payment.accountId),
      linked: !!x.payment.accountId,
    })),
    ...movements
      .filter((m) => m.type === "transfer_out")
      .map((m) => {
        const destination = movements.find(
          (n) => n.referenceId === m.referenceId && n.type === "transfer_in",
        );
        return {
          id: m.referenceId,
          label: m.description,
          amount: -m.amount,
          date: m.occurredAt,
          notes: "",
          category: "",
          type: "transfer" as const,
          planCategory: transferPlans.find(p => p.id === m.referenceId)?.planCategory ?? null,
          accountId: m.accountId,
          context:
            name(m.accountId) + " → " + name(destination?.accountId ?? null),
          linked: true,
          reverted: movements.some(
            (n) => n.referenceId === m.referenceId && n.type === "reversal",
          ),
        };
      }),
    ...movements
      .filter(
        (m) =>
          !["income", "expense", "transfer_out", "transfer_in"].includes(
            m.type,
          ) &&
          !(
            (m.type === "bill_payment" &&
              paidBills.some((x) => x.payment.id === m.referenceId)) ||
            (m.type === "debt_payment" &&
              paidDebts.some((x) => x.payment.id === m.referenceId))
          ),
      )
      .map((m) => ({
        id: m.id,
        label: m.description,
        amount: m.amount,
        date: m.occurredAt,
        notes: "",
        category:
          m.type === "adjustment"
            ? "Balance Adjustment"
            : m.type.replaceAll("_", " "),
        type: "movement" as const,
        accountId: m.accountId,
        context: name(m.accountId),
        linked: true,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <CashFlowPage
      initialFilter={requestedFilter === "uncategorized" || isPlanCategory(requestedFilter) ? requestedFilter : "all"}
      items={items}
      accounts={accounts}
      month={currentMonth().month}
      summary={summary}
    />
  );
}
