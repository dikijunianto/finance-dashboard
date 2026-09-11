import { and, desc, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { billPayments, bills, debts } from "@/db/schema";
import { BillsDebtPage } from "@/components/bills/bills-debt-page";
import { currentMonth } from "@/lib/dates";
import { requireAuth } from "@/lib/auth/require-auth";
export default async function Page() {
  await requireAuth();
  const { month, start, next } = currentMonth();
  const [billRows, debtRows, payments] = await Promise.all([
    db.select().from(bills).orderBy(desc(bills.createdAt)),
    db.select().from(debts).orderBy(desc(debts.createdAt)),
    db
      .select()
      .from(billPayments)
      .where(
        and(
          gte(billPayments.billingMonth, start),
          lt(billPayments.billingMonth, next),
        ),
      ),
  ]);
  const paid = payments.filter((p) => p.status === "paid");
  return (
    <BillsDebtPage
      bills={billRows}
      debts={debtRows}
      paidBillIds={paid.map((p) => p.billId)}
      paidTotal={paid.reduce((n, p) => n + p.amount, 0)}
      month={month}
    />
  );
}
