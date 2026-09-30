import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accountMovements, financeAccounts } from "@/db/schema";
import { requireOwner } from "@/lib/action-result";
import { requireAuth } from "@/lib/auth/require-auth";
import { AccountsPage } from "@/components/accounts/accounts-page";
export default async function Page() {
  await requireAuth();
  const userId = await requireOwner();
  const accounts = await db
    .select({
      id: financeAccounts.id,
      name: financeAccounts.name,
      type: financeAccounts.type,
      institution: financeAccounts.institution,
      balance: financeAccounts.balance,
      isActive: financeAccounts.isActive,
    })
    .from(financeAccounts)
    .where(eq(financeAccounts.userId, userId))
    .orderBy(desc(financeAccounts.isActive), desc(financeAccounts.createdAt));
  const movements = await db
    .select()
    .from(accountMovements)
    .where(eq(accountMovements.userId, userId))
    .orderBy(desc(accountMovements.createdAt));
  return (
    <AccountsPage
      accounts={accounts}
      movements={movements.map((m) => ({
        id: m.id,
        accountId: m.accountId,
        amount: m.amount,
        description: m.description,
        date: m.occurredAt,
        type: m.type,
      }))}
    />
  );
}
