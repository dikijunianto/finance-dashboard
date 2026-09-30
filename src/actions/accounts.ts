"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { financeAccounts } from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { accountTypes } from "@/lib/accounts";
import {
  lockAccounts,
  moveMoney,
  requestId,
  requestHash,
  wasApplied,
} from "@/lib/account-movements";
import { jakartaDate } from "@/lib/dates";

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
const accountInput = metadata.extend({
  type: z.enum(accountTypes),
  balance,
  requestId,
});
function done() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/cash-flow");
  revalidatePath("/bills");
}

export async function createAccount(form: FormData) {
  return mutationResult(async () => {
    const data = accountInput.parse(Object.fromEntries(form));
    const userId = await requireOwner();
    const hash = requestHash("opening_balance", data);
    await db.transaction(async (tx) => {
      // A per-request native lock makes account creation retries safe before an account exists.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${data.requestId}, 0))`,
      );
      if (await wasApplied(tx, userId, data.requestId, hash)) return;
      const [account] = await tx
        .insert(financeAccounts)
        .values({
          name: data.name,
          type: data.type,
          institution: data.institution || null,
          balance: 0,
          userId,
          isActive: true,
        })
        .returning();
      await moveMoney(tx, userId, {
        accountId: account.id,
        amount: data.balance,
        type: "opening_balance",
        referenceType: "account",
        referenceId: account.id,
        description: "Opening balance",
        occurredAt: jakartaDate(),
        requestId: data.requestId,
        requestHash: hash,
      });
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
    const key = requestId.parse(form.get("requestId"));
    const note = z
      .string()
      .trim()
      .max(1000)
      .parse(form.get("notes") ?? "");
    const userId = await requireOwner();
    const hash = requestHash("adjustment", { id, value, note });
    await db.transaction(async (tx) => {
      await lockAccounts(tx, userId, [id]);
      if (await wasApplied(tx, userId, key, hash)) return;
      const [a] = await tx
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.id, id));
      await moveMoney(tx, userId, {
        accountId: id,
        amount: value - a.balance,
        type: "adjustment",
        referenceType: "account",
        referenceId: id,
        description: note || "Balance reconciled",
        occurredAt: jakartaDate(),
        requestId: key,
        requestHash: hash,
      });
    });
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
