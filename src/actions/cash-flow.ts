"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenses, income, user } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
const record = z.object({ id:z.string().uuid().optional(), label:z.string().trim().min(1).max(120), amount:z.coerce.number().int().min(1).max(2_147_483_647), date:z.string().date(), notes:z.string().trim().max(240).optional() });
async function owner() { await requireAuth(); const email="local@myfinance.private"; const existing=await db.select().from(user).where(eq(user.email,email)).limit(1); if(existing[0]) return existing[0].id; const [created]=await db.insert(user).values({email,name:"MyFinance owner",emailVerified:true}).returning(); return created.id; }
const done=()=>{revalidatePath("/cash-flow");revalidatePath("/dashboard");};
export async function createIncome(formData:FormData) { const data=record.parse(Object.fromEntries(formData)); const userId=await owner(); await db.insert(income).values({userId,source:data.label,amount:data.amount,receivedAt:data.date,notes:data.notes||null}); done(); }
export async function updateIncome(formData:FormData) { const data=record.parse(Object.fromEntries(formData)); const userId=await owner(); await db.update(income).set({source:data.label,amount:data.amount,receivedAt:data.date,notes:data.notes||null}).where(and(eq(income.id,data.id!),eq(income.userId,userId))); done(); }
export async function deleteIncome(formData:FormData) { const id=z.string().uuid().parse(formData.get("id")); const userId=await owner(); await db.delete(income).where(and(eq(income.id,id),eq(income.userId,userId))); done(); }
export async function createExpense(formData:FormData) { const data=record.parse(Object.fromEntries(formData)); const userId=await owner(); await db.insert(expenses).values({userId,category:data.notes||"Other",description:data.label,amount:data.amount,spentAt:data.date,notes:null}); done(); }
export async function updateExpense(formData:FormData) { const data=record.parse(Object.fromEntries(formData)); const userId=await owner(); await db.update(expenses).set({category:data.notes||"Other",description:data.label,amount:data.amount,spentAt:data.date}).where(and(eq(expenses.id,data.id!),eq(expenses.userId,userId))); done(); }
export async function deleteExpense(formData:FormData) { const id=z.string().uuid().parse(formData.get("id")); const userId=await owner(); await db.delete(expenses).where(and(eq(expenses.id,id),eq(expenses.userId,userId))); done(); }
