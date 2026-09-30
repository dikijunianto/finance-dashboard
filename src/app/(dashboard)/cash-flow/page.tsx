import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accountMovements,
  expenses,
  financeAccounts,
  income,
} from "@/db/schema";
import {
  CashFlowPage,
  type ActivityItem,
} from "@/components/cash-flow/cash-flow-page";
import { requireOwner } from "@/lib/action-result";
import { currentMonth } from "@/lib/dates";
export default async function Page() {
  const userId = await requireOwner();
  const [incomes, expenseRows, accounts, movements] = await Promise.all([
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
    })),
    ...expenseRows.map((x) => ({
      id: x.id,
      label: x.description,
      amount: x.amount,
      date: x.spentAt,
      notes: x.notes ?? "",
      category: x.category,
      type: "expense" as const,
      accountId: x.accountId,
      context: linked("expense", x.id)
        ? name(x.accountId)
        : "Unlinked / legacy",
      linked: linked("expense", x.id),
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
          ),
      )
      .map((m) => ({
        id: m.id,
        label: m.description,
        amount: m.amount,
        date: m.occurredAt,
        notes: "",
        category: m.type.replaceAll("_", " "),
        type: "movement" as const,
        accountId: m.accountId,
        context: name(m.accountId),
        linked: true,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <CashFlowPage
      items={items}
      accounts={accounts}
      month={currentMonth().month}
    />
  );
}
