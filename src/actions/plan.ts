"use server";
import { and, eq, gte, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { budgets, user } from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { currentMonth } from "@/lib/dates";
const categories = [
  "bills_debt",
  "living",
  "savings",
  "investments",
  "lifestyle",
  "buffer",
] as const;
const amount = z.coerce.number().int().min(0).max(2_147_483_647);
const plan = z.object({
  bills_debt: amount,
  living: amount,
  savings: amount,
  investments: amount,
  lifestyle: amount,
  buffer: amount,
});
export async function updateMonthlyPlan(formData: FormData) {
  return mutationResult(async () => {
    const values = plan.parse(Object.fromEntries(formData));
    const userId = await requireOwner();
    const { start: month, next } = currentMonth();
    if (formData.get("month") !== month)
      throw new InputError(
        "The month has changed. Refresh before editing this month's plan.",
      );
    await db.transaction(async (tx) => {
      // Serialize this owner's allocation edits; no new uniqueness constraint or data rewrite.
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("update");
      for (const category of categories) {
        const rows = await tx
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.userId, userId),
              gte(budgets.month, month),
              lt(budgets.month, next),
              eq(budgets.category, category),
            ),
          );
        if (rows.length > 1)
          throw new InputError(
            "This plan has duplicate allocation rows. No changes were saved; existing rows need review.",
          );
        if (rows[0])
          await tx
            .update(budgets)
            .set({ allocatedAmount: values[category] })
            .where(eq(budgets.id, rows[0].id));
        else
          await tx.insert(budgets).values({
            userId,
            month,
            category,
            allocatedAmount: values[category],
          });
      }
    });
    revalidatePath("/budget");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
  });
}
