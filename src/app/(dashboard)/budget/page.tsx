import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { budgets, income } from "@/db/schema";
import { PlanPage } from "@/components/plan/plan-page";
export default async function Page(){const month=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit"}).format(new Date());const [y,m]=month.split("-").map(Number);const next=`${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,"0")}-01`;const [incomeRows,budgetRows]=await Promise.all([db.select().from(income).where(and(gte(income.receivedAt,`${month}-01`),lt(income.receivedAt,next))),db.select().from(budgets).where(eq(budgets.month,`${month}-01`))]);const values=Object.fromEntries(budgetRows.map(b=>[b.category,b.allocatedAmount]));return <PlanPage income={incomeRows.reduce((n,x)=>n+x.amount,0)} values={values}/>}
