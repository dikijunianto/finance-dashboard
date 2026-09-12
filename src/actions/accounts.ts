"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { financeAccounts } from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { accountTypes } from "@/lib/accounts";

const balance = z
  .string()
  .trim()
  .min(1)
  .transform(Number)
  .pipe(z.number().int().min(-2_147_483_648).max(2_147_483_647));
const metadata = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(60),
  institution: z.string().trim().max(120).optional(),
});
const accountInput = metadata.extend({ type: z.enum(accountTypes), balance });
function done() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createAccount(form: FormData) {
  return mutationResult(async () => {
    const data = accountInput.parse(Object.fromEntries(form));
    await db.insert(financeAccounts).values({
      ...data,
      institution: data.institution || null,
      userId: await requireOwner(),
      isActive: true,
    });
    done();
  });
}
export async function updateAccount(form: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(form.get("id"));
    const data = metadata
      .extend({
        isActive: z
          .enum(["true", "false"])
          .transform((value) => value === "true"),
      })
      .parse(Object.fromEntries(form));
    const userId = await requireOwner();
    const owned = and(
      eq(financeAccounts.id, id),
      eq(financeAccounts.userId, userId),
    );
    const [existing] = await db
      .select({ type: financeAccounts.type })
      .from(financeAccounts)
      .where(owned);
    if (!existing)
      throw new InputError("Account no longer exists. Refresh the page.");
    // Keep legacy string types editable without silently converting them.
    if (
      !accountTypes.some((type) => type === data.type) &&
      data.type !== existing.type
    )
      throw new InputError("Choose a supported account type.");
    const rows = await db
      .update(financeAccounts)
      .set({
        ...data,
        institution: data.institution || null,
        updatedAt: new Date(),
      })
      .where(owned)
      .returning({ id: financeAccounts.id });
    if (!rows.length)
      throw new InputError("Account no longer exists. Refresh the page.");
    done();
  });
}
export async function updateAccountBalance(form: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(form.get("id"));
    const value = balance.parse(form.get("balance"));
    const userId = await requireOwner();
    const rows = await db
      .update(financeAccounts)
      .set({ balance: value, updatedAt: new Date() })
      .where(
        and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)),
      )
      .returning({ id: financeAccounts.id });
    if (!rows.length)
      throw new InputError("Account no longer exists. Refresh the page.");
    done();
  });
}
export async function deactivateAccount(form: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(form.get("id"));
    const userId = await requireOwner();
    const rows = await db
      .update(financeAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)),
      )
      .returning({ id: financeAccounts.id });
    if (!rows.length)
      throw new InputError("Account no longer exists. Refresh the page.");
    done();
  });
}
