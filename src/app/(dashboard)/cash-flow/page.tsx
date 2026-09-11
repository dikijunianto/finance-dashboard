import { desc } from "drizzle-orm";
import { db } from "@/db";
import { expenses, income } from "@/db/schema";
import { CashFlowPage } from "@/components/cash-flow/cash-flow-page";
export default async function Page() { const [incomes, expenseRows]=await Promise.all([db.select().from(income).orderBy(desc(income.receivedAt)),db.select().from(expenses).orderBy(desc(expenses.spentAt))]); const items=[...incomes.map(x=>({id:x.id,label:x.source,amount:x.amount,date:x.receivedAt,notes:x.notes??"",type:"income" as const})),...expenseRows.map(x=>({id:x.id,label:x.description,amount:x.amount,date:x.spentAt,notes:x.category,type:"expense" as const}))].sort((a,b)=>b.date.localeCompare(a.date)); return <CashFlowPage items={items}/>; }
