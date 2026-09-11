"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { budgets, user } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
const categories=["bills_debt","living","savings","investments","lifestyle","buffer"] as const;
const amount=z.coerce.number().int().min(0).max(2_147_483_647); const plan=z.object({bills_debt:amount,living:amount,savings:amount,investments:amount,lifestyle:amount,buffer:amount});
async function owner(){await requireAuth();const email="local@myfinance.private";const found=await db.select().from(user).where(eq(user.email,email)).limit(1);if(found[0])return found[0].id;return(await db.insert(user).values({email,name:"MyFinance owner",emailVerified:true}).returning())[0].id}
export async function updateMonthlyPlan(formData:FormData){const values=plan.parse(Object.fromEntries(formData));const userId=await owner();const month=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit"}).format(new Date())+"-01";await db.transaction(async tx=>{for(const category of categories){const rows=await tx.select().from(budgets).where(and(eq(budgets.userId,userId),eq(budgets.month,month),eq(budgets.category,category))).limit(1);if(rows[0])await tx.update(budgets).set({allocatedAmount:values[category]}).where(eq(budgets.id,rows[0].id));else await tx.insert(budgets).values({userId,month,category,allocatedAmount:values[category]})}});revalidatePath("/budget");revalidatePath("/dashboard")}
