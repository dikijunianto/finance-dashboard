import { desc } from "drizzle-orm";
import { db } from "@/db";
import { bills, debts } from "@/db/schema";
import { BillsDebtPage } from "@/components/bills/bills-debt-page";
export default async function Page(){return <BillsDebtPage bills={await db.select().from(bills).orderBy(desc(bills.createdAt))} debts={await db.select().from(debts).orderBy(desc(debts.createdAt))}/>}
