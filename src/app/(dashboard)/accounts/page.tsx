import { desc } from "drizzle-orm";
import { db } from "@/db";
import { financeAccounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
import { AccountsPage } from "@/components/accounts/accounts-page";
export default async function Page() {
  await requireAuth();
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
    .orderBy(desc(financeAccounts.isActive), desc(financeAccounts.createdAt));
  return <AccountsPage accounts={accounts} />;
}
