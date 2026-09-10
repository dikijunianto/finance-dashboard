"use server";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { plannerItems } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
const item = z.object({ section: z.string().min(1), name: z.string().trim().min(1).max(120), detail: z.string().trim().max(240), amount: z.coerce.number().int().min(0) });
const path = (section: string) => `/${section}`;
export async function listPlannerItems(section: string) { const session = await requireAuth(); return db.select().from(plannerItems).where(and(eq(plannerItems.username, session.username), eq(plannerItems.section, section))).orderBy(desc(plannerItems.createdAt)); }
export async function createPlannerItem(formData: FormData) { const session = await requireAuth(); const input = item.parse(Object.fromEntries(formData)); await db.insert(plannerItems).values({ ...input, username: session.username }); revalidatePath(path(input.section)); }
export async function updatePlannerItem(formData: FormData) { const session = await requireAuth(); const id = z.string().uuid().parse(formData.get("id")); const input = item.parse(Object.fromEntries(formData)); await db.update(plannerItems).set({ name: input.name, detail: input.detail, amount: input.amount, updatedAt: new Date() }).where(and(eq(plannerItems.id, id), eq(plannerItems.username, session.username))); revalidatePath(path(input.section)); }
export async function deletePlannerItem(formData: FormData) { const session = await requireAuth(); const id = z.string().uuid().parse(formData.get("id")); const section = z.string().min(1).parse(formData.get("section")); await db.delete(plannerItems).where(and(eq(plannerItems.id, id), eq(plannerItems.username, session.username))); revalidatePath(path(section)); }
