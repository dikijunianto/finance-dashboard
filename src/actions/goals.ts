"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { isGoalCompleted } from "@/lib/finance/calculations";
const money = z.coerce.number().int().min(0).max(2_147_483_647);
const metadata = z.object({
  name: z.string().trim().min(1).max(120),
  targetAmount: money.refine((n) => n > 0),
  targetDate: z.union([z.literal(""), z.string().date()]).optional(),
  priority: z.coerce.number().int().min(1).max(3),
});
const goal = metadata.extend({ currentAmount: money });
function done() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
export async function createGoal(f: FormData) {
  return mutationResult(async () => {
    const d = goal.parse(Object.fromEntries(f));
    if (d.currentAmount > d.targetAmount)
      throw new InputError("Current amount cannot exceed target.");
    await db
      .insert(goals)
      .values({
        ...d,
        userId: await requireOwner(),
        goalType: "other",
        targetDate: d.targetDate || null,
        status: d.currentAmount === d.targetAmount ? "completed" : "active",
      });
    done();
  });
}
export async function updateGoal(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const d = metadata.parse(Object.fromEntries(f));
    const userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [g] = await tx
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .for("update");
      if (!g) throw new InputError("Goal no longer exists. Refresh the page.");
      if (g.currentAmount > d.targetAmount)
        throw new InputError("Target cannot be less than saved progress.");
      await tx
        .update(goals)
        .set({
          ...d,
          targetDate: d.targetDate || null,
          status: g.currentAmount === d.targetAmount ? "completed" : "active",
        })
        .where(eq(goals.id, id));
    });
    done();
  });
}
export async function addGoalProgress(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const amount = money.refine((n) => n > 0).parse(f.get("amount"));
    const userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [g] = await tx
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .for("update");
      if (!g) throw new InputError("Goal no longer exists. Refresh the page.");
      if (isGoalCompleted(g))
        throw new InputError("Goal is already completed.");
      if (g.currentAmount + amount > g.targetAmount)
        throw new InputError("Contribution exceeds remaining amount.");
      await tx
        .update(goals)
        .set({
          currentAmount: g.currentAmount + amount,
          status:
            g.currentAmount + amount === g.targetAmount
              ? "completed"
              : "active",
        })
        .where(eq(goals.id, id));
    });
    done();
  });
}
export async function deleteGoal(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const userId = await requireOwner();
    const deleted = await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    if (!deleted.length)
      throw new InputError("Goal no longer exists. Refresh the page.");
    done();
  });
}
