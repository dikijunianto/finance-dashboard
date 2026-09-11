"use server";
// Compatibility names for the existing Settings notes UI only.
// Finance domains must use their explicit domain actions.
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cfoNotes } from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { requireAuth } from "@/lib/auth/require-auth";
import { currentMonth } from "@/lib/dates";
const input = z.object({
  section: z.literal("settings"),
  name: z.string().trim().min(1).max(1000),
  detail: z.string().trim().max(120),
});
function done() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
export async function listPlannerItems(section: string) {
  await requireAuth();
  z.literal("settings").parse(section);
  return (
    await db.select().from(cfoNotes).orderBy(desc(cfoNotes.createdAt))
  ).map((x) => ({ id: x.id, name: x.content, detail: x.category }));
}
export async function createPlannerItem(f: FormData) {
  return mutationResult(async () => {
    const d = input.parse(Object.fromEntries(f));
    await db
      .insert(cfoNotes)
      .values({
        userId: await requireOwner(),
        month: currentMonth().start,
        content: d.name,
        category: d.detail || "general",
      });
    done();
  });
}
export async function updatePlannerItem(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const d = input.parse(Object.fromEntries(f));
    const userId = await requireOwner();
    const rows = await db
      .update(cfoNotes)
      .set({ content: d.name, category: d.detail || "general" })
      .where(and(eq(cfoNotes.id, id), eq(cfoNotes.userId, userId)))
      .returning({ id: cfoNotes.id });
    if (!rows.length)
      throw new InputError("Note no longer exists. Refresh the page.");
    done();
  });
}
export async function deletePlannerItem(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const userId = await requireOwner();
    const rows = await db
      .delete(cfoNotes)
      .where(and(eq(cfoNotes.id, id), eq(cfoNotes.userId, userId)))
      .returning({ id: cfoNotes.id });
    if (!rows.length)
      throw new InputError("Note no longer exists. Refresh the page.");
    done();
  });
}
