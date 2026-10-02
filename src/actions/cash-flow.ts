"use server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenses, income, financeAccounts, transferPlanAttributions } from "@/db/schema";
import { planCategories } from "@/lib/plan-categories";
import { isLiquidAccount } from "@/lib/accounts";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import {
  accountId,
  money,
  requestId,
  requestHash,
  lockAccounts,
  moveMoney,
  sourceMovements,
  reverseSource,
  wasApplied,
} from "@/lib/account-movements";
import { jakartaDate } from "@/lib/dates";
const record = z.object({
  label: z.string().trim().min(1).max(120),
  amount: money,
  date: z.string().date(),
  accountId,
  requestId,
  notes: z.string().trim().max(1000).optional(),
});
const expenseInput = record.extend({
  planCategory: z.enum(planCategories),
});
const incomeInput = record.extend({
  fundingMonth: z
    .string()
    .date()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/)
    .optional(),
});
function done() {
  for (const route of [
    "/cash-flow",
    "/accounts",
    "/dashboard",
    "/budget",
    "/reports",
  ])
    revalidatePath(route);
}
export async function createIncome(form: FormData) {
  return mutationResult(async () => {
    const d = incomeInput.parse(Object.fromEntries(form)),
      userId = await requireOwner(),
      hash = requestHash("income", d);
    await db.transaction(async (tx) => {
      await lockAccounts(tx, userId, [d.accountId]);
      if (await wasApplied(tx, userId, d.requestId, hash)) return;
      await lockAccounts(tx, userId, [d.accountId], [d.accountId]);
      const [row] = await tx
        .insert(income)
        .values({
          userId,
          accountId: d.accountId,
          source: d.label,
          amount: d.amount,
          receivedAt: d.date,
          fundingMonth: d.fundingMonth ?? d.date.slice(0, 7) + "-01",
          notes: d.notes || null,
        })
        .returning();
      await moveMoney(tx, userId, {
        accountId: d.accountId,
        amount: d.amount,
        type: "income",
        referenceType: "income",
        referenceId: row.id,
        description: d.label,
        occurredAt: d.date,
        requestId: d.requestId,
        requestHash: hash,
      });
    });
    done();
  });
}
export async function createExpense(form: FormData) {
  return mutationResult(async () => {
    const d = expenseInput.parse(Object.fromEntries(form)),
      userId = await requireOwner(),
      hash = requestHash("expense", d);
    await db.transaction(async (tx) => {
      await lockAccounts(tx, userId, [d.accountId]);
      if (await wasApplied(tx, userId, d.requestId, hash)) return;
      await lockAccounts(tx, userId, [d.accountId], [d.accountId]);
      const [row] = await tx
        .insert(expenses)
        .values({
          userId,
          accountId: d.accountId,
          description: d.label,
          category: d.planCategory,
          planCategory: d.planCategory,
          amount: d.amount,
          spentAt: d.date,
          notes: d.notes || null,
        })
        .returning();
      await moveMoney(tx, userId, {
        accountId: d.accountId,
        amount: -d.amount,
        type: "expense",
        referenceType: "expense",
        referenceId: row.id,
        description: d.label,
        occurredAt: d.date,
        requestId: d.requestId,
        requestHash: hash,
      });
    });
    done();
  });
}
export async function updateIncome(form: FormData) {
  return mutationResult(async () => {
    const d = incomeInput
      .extend({
        id: z.string().uuid(),
        accountId: accountId.or(z.literal("")),
      })
      .parse(Object.fromEntries(form)),
      userId = await requireOwner(),
      hash = requestHash("update_income", d);
    await db.transaction(async (tx) => {
      const [old] = await tx
        .select()
        .from(income)
        .where(and(eq(income.id, d.id), eq(income.userId, userId)))
        .for("update");
      if (!old)
        throw new InputError("Transaction no longer exists. Refresh the page.");
      // Funding/source/notes metadata does not move money. Preserve legacy unlinked state too.
      if (
        old.amount === d.amount &&
        (old.accountId ?? "") === d.accountId &&
        old.receivedAt === d.date
      ) {
        if (await wasApplied(tx, userId, d.requestId, hash)) return;
        await tx
          .update(income)
          .set({
            source: d.label,
            receivedAt: d.date,
            notes: d.notes || null,
            fundingMonth:
              d.fundingMonth ??
              old.fundingMonth ??
              old.receivedAt.slice(0, 7) + "-01",
            updatedAt: new Date(),
          })
          .where(eq(income.id, d.id));
        return;
      }
      if (!d.accountId)
        throw new InputError(
          "Select an account to change this legacy transaction's amount or date.",
        );
      const rows = await sourceMovements(tx, userId, "income", d.id);
      await lockAccounts(tx, userId, [
        d.accountId,
        ...rows.map((m) => m.accountId),
      ]);
      if (await wasApplied(tx, userId, d.requestId, hash)) return;
      await lockAccounts(tx, userId, [d.accountId], [d.accountId]);
      await reverseSource(
        tx,
        userId,
        "income",
        d.id,
        jakartaDate(),
        "Income edit — reverse previous effect",
      );
      await tx
        .update(income)
        .set({
          accountId: d.accountId,
          source: d.label,
          amount: d.amount,
          receivedAt: d.date,
          fundingMonth:
            d.fundingMonth ?? old.fundingMonth ?? d.date.slice(0, 7) + "-01",
          notes: d.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(income.id, d.id));
      await moveMoney(tx, userId, {
        accountId: d.accountId,
        amount: d.amount,
        type: "income",
        referenceType: "income",
        referenceId: d.id,
        description: d.label,
        occurredAt: d.date,
        requestId: d.requestId,
        requestHash: hash,
      });
    });
    done();
  });
}
export async function updateExpense(form: FormData) {
  return mutationResult(async () => {
    const d = expenseInput
      .extend({ id: z.string().uuid(), accountId: accountId.or(z.literal("")) })
      .parse(Object.fromEntries(form)),
      userId = await requireOwner(),
      hash = requestHash("update_expense", d);
    await db.transaction(async (tx) => {
      const [old] = await tx
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, d.id), eq(expenses.userId, userId)))
        .for("update");
      if (!old)
        throw new InputError("Transaction no longer exists. Refresh the page.");
      // Attribution/description/notes-only edits must not replay any money movement.
      if (old.amount === d.amount && (old.accountId ?? "") === d.accountId && old.spentAt === d.date) {
        if (await wasApplied(tx, userId, d.requestId, hash)) return;
        await tx.update(expenses).set({
          planCategory: d.planCategory,
          description: d.label,
          notes: d.notes || null,
          updatedAt: new Date(),
        }).where(eq(expenses.id, d.id));
        return;
      }
      if (!d.accountId) throw new InputError("Select an account to change this legacy transaction's amount or date.");
      const rows = await sourceMovements(tx, userId, "expense", d.id);
      await lockAccounts(tx, userId, [
        d.accountId,
        ...rows.map((m) => m.accountId),
      ]);
      if (await wasApplied(tx, userId, d.requestId, hash)) return;
      await lockAccounts(tx, userId, [d.accountId], [d.accountId]);
      await reverseSource(
        tx,
        userId,
        "expense",
        d.id,
        jakartaDate(),
        "Expense edit — reverse previous effect",
      );
      await tx
        .update(expenses)
        .set({
          accountId: d.accountId,
          description: d.label,
          planCategory: d.planCategory,
          amount: d.amount,
          spentAt: d.date,
          notes: d.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, d.id));
      await moveMoney(tx, userId, {
        accountId: d.accountId,
        amount: -d.amount,
        type: "expense",
        referenceType: "expense",
        referenceId: d.id,
        description: d.label,
        occurredAt: d.date,
        requestId: d.requestId,
        requestHash: hash,
      });
    });
    done();
  });
}
export async function deleteIncome(form: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(form.get("id")),
      userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(income)
        .where(and(eq(income.id, id), eq(income.userId, userId)))
        .for("update");
      if (!row)
        throw new InputError("Transaction no longer exists. Refresh the page.");
      await reverseSource(
        tx,
        userId,
        "income",
        id,
        jakartaDate(),
        "Deleted income: " + row.source,
      );
      await tx.delete(income).where(eq(income.id, id));
    });
    done();
  });
}
export async function deleteExpense(form: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(form.get("id")),
      userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .for("update");
      if (!row)
        throw new InputError("Transaction no longer exists. Refresh the page.");
      await reverseSource(
        tx,
        userId,
        "expense",
        id,
        jakartaDate(),
        "Deleted expense: " + row.description,
      );
      await tx.delete(expenses).where(eq(expenses.id, id));
    });
    done();
  });
}
export async function createTransfer(form: FormData) {
  return mutationResult(async () => {
    const d = z
      .object({
        fromAccountId: accountId,
        toAccountId: accountId,
        amount: money,
        date: z.string().date(),
        notes: z.string().trim().max(1000).optional(),
        requestId,
        planImpact: z.enum(["none", "savings"]).default("none"),
      })
      .parse(Object.fromEntries(form));
    if (d.fromAccountId === d.toAccountId)
      throw new InputError(
        "Source and destination accounts must be different.",
      );
    const userId = await requireOwner(),
      hash = requestHash("transfer", d);
    await db.transaction(async (tx) => {
      const ids = [d.fromAccountId, d.toAccountId];
      await lockAccounts(tx, userId, ids);
      if (await wasApplied(tx, userId, d.requestId, hash)) return;
      await lockAccounts(tx, userId, ids, ids);
      const referenceId = randomUUID();
      const [from] = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, d.fromAccountId));
      const [to] = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, d.toAccountId));
      const liquidSource = isLiquidAccount(from);
      if (d.planImpact === "savings" && (!liquidSource || to.type === "investment"))
        throw new InputError("Savings impact requires a liquid source and non-investment destination.");
      const planCategory = liquidSource && to.type === "investment" ? "investments" : d.planImpact === "savings" ? "savings" : null;
      if (planCategory) await tx.insert(transferPlanAttributions).values({ id: referenceId, userId, planCategory });
      await moveMoney(tx, userId, {
        accountId: d.fromAccountId,
        amount: -d.amount,
        type: "transfer_out",
        referenceType: "transfer",
        referenceId,
        description: d.notes || "Transfer",
        occurredAt: d.date,
        requestId: d.requestId,
        requestHash: hash,
      });
      await moveMoney(tx, userId, {
        accountId: d.toAccountId,
        amount: d.amount,
        type: "transfer_in",
        referenceType: "transfer",
        referenceId,
        description: d.notes || "Transfer",
        occurredAt: d.date,
      });
    });
    done();
  });
}
export async function revertTransfer(form: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(form.get("id")),
      userId = await requireOwner();
    await db.transaction(async (tx) => {
      const rows = await sourceMovements(tx, userId, "transfer", id);
      if (!rows.length) throw new InputError("Transfer no longer exists.");
      await lockAccounts(
        tx,
        userId,
        rows.map((r) => r.accountId),
      );
      const fresh = await sourceMovements(tx, userId, "transfer", id);
      if (fresh.some((r) => r.type === "reversal")) return;
      await reverseSource(
        tx,
        userId,
        "transfer",
        id,
        jakartaDate(),
        "Transfer reverted",
      );
    });
    done();
  });
}
