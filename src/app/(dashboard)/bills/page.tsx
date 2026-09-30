import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { billPayments, bills, debts, financeAccounts } from "@/db/schema";
import { requireOwner } from "@/lib/action-result";
import { BillsDebtPage } from "@/components/bills/bills-debt-page";
import { currentMonth } from "@/lib/dates";
import { requireAuth } from "@/lib/auth/require-auth";
export default async function Page() {
  await requireAuth();
  const userId = await requireOwner();
  const { month, start, next } = currentMonth();
  const [billRows, debtRows, payments, accounts] = await Promise.all([
    db
      .select()
      .from(bills)
      .where(eq(bills.userId, userId))
      .orderBy(desc(bills.createdAt)),
    db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(desc(debts.createdAt)),
    db
      .select()
      .from(billPayments)
      .where(
        and(
          eq(billPayments.userId, userId),
          gte(billPayments.billingMonth, start),
          lt(billPayments.billingMonth, next),
        ),
      ),
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
  ]);
  const paid = payments.filter((p) => p.status === "paid");
  return (
    <BillsDebtPage
      bills={billRows}
      debts={debtRows}
      paidBillIds={paid.map((p) => p.billId)}
      paidTotal={paid.reduce((n, p) => n + p.amount, 0)}
      month={month}
      accounts={accounts}
    />
  );
}
