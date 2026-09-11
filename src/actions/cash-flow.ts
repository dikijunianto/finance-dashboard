"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenses, income } from "@/db/schema";
import {
  InputError,
  mutationResult,
  requireOwner as owner,
} from "@/lib/action-result";
const record = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(120),
  amount: z.coerce.number().int().min(1).max(2_147_483_647),
  date: z.string().date(),
  notes: z.string().trim().max(240).optional(),
});

const done = () => {
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/reports");
};
export async function createIncome(formData: FormData) {
  return mutationResult(async () => {
    const data = record.parse(Object.fromEntries(formData));
    const userId = await owner();
    await db.insert(income).values({
      userId,
      source: data.label,
      amount: data.amount,
      receivedAt: data.date,
      notes: data.notes || null,
    });
    done();
  });
}
export async function updateIncome(formData: FormData) {
  return mutationResult(async () => {
    const data = record
      .extend({ id: z.string().uuid() })
      .parse(Object.fromEntries(formData));
    const userId = await owner();
    const rows = await db
      .update(income)
      .set({
        source: data.label,
        amount: data.amount,
        receivedAt: data.date,
        notes: data.notes || null,
      })
      .where(and(eq(income.id, data.id!), eq(income.userId, userId)))
      .returning({ id: income.id });
    if (!rows.length)
      throw new InputError("Transaction no longer exists. Refresh the page.");
    done();
  });
}
export async function deleteIncome(formData: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(formData.get("id"));
    const userId = await owner();
    const rows = await db
      .delete(income)
      .where(and(eq(income.id, id), eq(income.userId, userId)))
      .returning({ id: income.id });
    if (!rows.length)
      throw new InputError("Transaction no longer exists. Refresh the page.");
    done();
  });
}
export async function createExpense(formData: FormData) {
  return mutationResult(async () => {
    const data = record.parse(Object.fromEntries(formData));
    const userId = await owner();
    await db.insert(expenses).values({
      userId,
      category: data.notes || "Other",
      description: data.label,
      amount: data.amount,
      spentAt: data.date,
      notes: null,
    });
    done();
  });
}
export async function updateExpense(formData: FormData) {
  return mutationResult(async () => {
    const data = record
      .extend({ id: z.string().uuid() })
      .parse(Object.fromEntries(formData));
    const userId = await owner();
    const rows = await db
      .update(expenses)
      .set({
        category: data.notes || "Other",
        description: data.label,
        amount: data.amount,
        spentAt: data.date,
      })
      .where(and(eq(expenses.id, data.id!), eq(expenses.userId, userId)))
      .returning({ id: expenses.id });
    if (!rows.length)
      throw new InputError("Transaction no longer exists. Refresh the page.");
    done();
  });
}
export async function deleteExpense(formData: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(formData.get("id"));
    const userId = await owner();
    const rows = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning({ id: expenses.id });
    if (!rows.length)
      throw new InputError("Transaction no longer exists. Refresh the page.");
    done();
  });
}
