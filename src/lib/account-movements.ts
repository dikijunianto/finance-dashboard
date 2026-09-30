import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accountMovements, financeAccounts } from "@/db/schema";
import { InputError } from "@/lib/action-result";

export type MoneyTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const money = z.coerce.number().int().min(1).max(2_147_483_647);
export const accountId = z.string().uuid({ message: "Select an account." });
export const requestId = z.string().uuid();
export function requestHash(kind: string, data: unknown) {
  return createHash("sha256")
    .update(kind + JSON.stringify(data))
    .digest("hex");
}

// All multi-account writes lock in UUID order, including reversals to inactive accounts.
export async function lockAccounts(
  tx: MoneyTx,
  userId: string,
  ids: string[],
  activeIds: string[] = [],
) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return;
  const rows = await tx
    .select()
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.userId, userId),
        inArray(financeAccounts.id, unique),
      ),
    )
    .orderBy(asc(financeAccounts.id))
    .for("update");
  if (rows.length !== unique.length)
    throw new InputError("The selected account no longer exists.");
  if (rows.some((a) => activeIds.includes(a.id) && !a.isActive))
    throw new InputError("Select an active account.");
}

export async function wasApplied(
  tx: MoneyTx,
  userId: string,
  id: string,
  hash: string,
) {
  const [row] = await tx
    .select()
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.userId, userId),
        eq(accountMovements.requestId, id),
      ),
    );
  if (row && row.requestHash !== hash)
    throw new InputError(
      "This request was already used. Close and reopen the form.",
    );
  return !!row;
}

export async function moveMoney(
  tx: MoneyTx,
  userId: string,
  movement: Omit<typeof accountMovements.$inferInsert, "userId">,
) {
  const [a] = await tx
    .select()
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.id, movement.accountId),
        eq(financeAccounts.userId, userId),
      ),
    )
    .for("update");
  if (!a) throw new InputError("The selected account no longer exists.");
  const next = a.balance + movement.amount;
  if (
    !Number.isSafeInteger(next) ||
    next < -2_147_483_648 ||
    next > 2_147_483_647
  )
    throw new InputError(
      "The resulting balance exceeds the supported whole-Rupiah range.",
    );
  await tx
    .update(financeAccounts)
    .set({ balance: next, updatedAt: new Date() })
    .where(eq(financeAccounts.id, a.id));
  await tx.insert(accountMovements).values({ ...movement, userId });
}

export async function sourceMovements(
  tx: MoneyTx,
  userId: string,
  type: string,
  id: string,
) {
  return tx
    .select()
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.userId, userId),
        eq(accountMovements.referenceType, type),
        eq(accountMovements.referenceId, id),
      ),
    );
}

export function accountEffects(rows: { accountId: string; amount: number }[]) {
  const effects = new Map<string, number>();
  for (const row of rows)
    effects.set(row.accountId, (effects.get(row.accountId) ?? 0) + row.amount);
  return effects;
}

export async function reverseSource(
  tx: MoneyTx,
  userId: string,
  type: string,
  id: string,
  date: string,
  description: string,
) {
  const effects = accountEffects(await sourceMovements(tx, userId, type, id));
  await lockAccounts(tx, userId, [...effects.keys()]);
  for (const [accountId, amount] of effects)
    if (amount !== 0) {
      await moveMoney(tx, userId, {
        accountId,
        amount: -amount,
        type: "reversal",
        referenceType: type,
        referenceId: id,
        description,
        occurredAt: date,
      });
    }
}
