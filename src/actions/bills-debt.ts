"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  accountMovements,
  billPayments,
  bills,
  debtPayments,
  debts,
} from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { billDueDate, currentMonth, jakartaDate } from "@/lib/dates";
import { isDebtPaidOff } from "@/lib/finance/calculations";
import {
  accountId,
  requestId,
  requestHash,
  lockAccounts,
  moveMoney,
  reverseSource,
  wasApplied,
} from "@/lib/account-movements";
const money = z.coerce.number().int().min(1).max(2_147_483_647);
const bill = z.object({
  name: z.string().trim().min(1).max(120),
  amount: money,
  dueDay: z.coerce.number().int().min(1).max(31),
  category: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).optional(),
});
const debt = z.object({
  name: z.string().trim().min(1).max(120),
  lender: z.string().trim().min(1).max(120),
  originalAmount: money,
  remainingAmount: money,
  installmentAmount: money,
  dueDay: z.coerce.number().int().min(1).max(31),
  notes: z.string().trim().max(1000).optional(),
});
function done() {
  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/accounts");
  revalidatePath("/cash-flow");
}
export async function createBill(f: FormData) {
  return mutationResult(async () => {
    const d = bill.parse(Object.fromEntries(f));
    await db
      .insert(bills)
      .values({ ...d, userId: await requireOwner(), frequency: "monthly" });
    done();
  });
}
export async function deleteBill(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [b] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.id, id), eq(bills.userId, userId)))
        .for("update");
      if (!b) throw new InputError("Bill no longer exists. Refresh the page.");
      const payments = await tx
        .select()
        .from(billPayments)
        .where(eq(billPayments.billId, id));
      if (payments.length) {
        const rows = await tx
          .select()
          .from(accountMovements)
          .where(
            and(
              eq(accountMovements.userId, userId),
              eq(accountMovements.referenceType, "bill_payment"),
              inArray(
                accountMovements.referenceId,
                payments.map((p) => p.id),
              ),
            ),
          );
        await lockAccounts(
          tx,
          userId,
          rows.map((r) => r.accountId),
        );
        for (const p of payments)
          await reverseSource(
            tx,
            userId,
            "bill_payment",
            p.id,
            jakartaDate(),
            `Deleted bill payment: ${b.name}`,
          );
      }
      await tx.delete(bills).where(eq(bills.id, id));
    });
    done();
  });
}
export async function markBillPaid(f: FormData) {
  return mutationResult(async () => {
    const d = z
      .object({
        id: z.string().uuid(),
        accountId,
        date: z.string().date(),
        requestId,
      })
      .parse(Object.fromEntries(f));
    const userId = await requireOwner(),
      hash = requestHash("bill_payment", d);
    const { start } = currentMonth();
    await db.transaction(async (tx) => {
      const [b] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.id, d.id), eq(bills.userId, userId)))
        .for("update");
      if (!b || !b.isActive)
        throw new InputError("Bill is not active. Refresh the page.");
      const [existing] = await tx
        .select()
        .from(billPayments)
        .where(
          and(
            eq(billPayments.billId, d.id),
            eq(billPayments.billingMonth, start),
          ),
        );
      // Business-key guard survives a retry with a new request ID.
      if (existing?.status === "paid") return;
      await lockAccounts(tx, userId, [d.accountId]);
      if (await wasApplied(tx, userId, d.requestId, hash)) return;
      await lockAccounts(tx, userId, [d.accountId], [d.accountId]);
      const [p] = await tx
        .insert(billPayments)
        .values({
          userId,
          billId: b.id,
          billingMonth: start,
          amount: b.amount,
          dueDate: billDueDate(start, b.dueDay),
          paidAt: new Date(d.date + "T12:00:00+07:00"),
          status: "paid",
          accountId: d.accountId,
        })
        .onConflictDoUpdate({
          target: [billPayments.billId, billPayments.billingMonth],
          set: {
            amount: b.amount,
            paidAt: new Date(d.date + "T12:00:00+07:00"),
            status: "paid",
            accountId: d.accountId,
          },
        })
        .returning();
      await moveMoney(tx, userId, {
        accountId: d.accountId,
        amount: -p.amount,
        type: "bill_payment",
        referenceType: "bill_payment",
        referenceId: p.id,
        description: b.name,
        occurredAt: d.date,
        requestId: d.requestId,
        requestHash: hash,
      });
    });
    done();
  });
}
export async function createDebt(f: FormData) {
  return mutationResult(async () => {
    const d = debt.parse(Object.fromEntries(f));
    if (d.remainingAmount > d.originalAmount)
      throw new InputError("Remaining amount cannot exceed original amount.");
    await db
      .insert(debts)
      .values({ ...d, userId: await requireOwner(), debtType: "other" });
    done();
  });
}
export async function deleteDebt(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [d] = await tx
        .select()
        .from(debts)
        .where(and(eq(debts.id, id), eq(debts.userId, userId)))
        .for("update");
      if (!d) throw new InputError("Debt no longer exists. Refresh the page.");
      const payments = await tx
        .select()
        .from(debtPayments)
        .where(eq(debtPayments.debtId, id));
      if (payments.length) {
        const rows = await tx
          .select()
          .from(accountMovements)
          .where(
            and(
              eq(accountMovements.userId, userId),
              eq(accountMovements.referenceType, "debt_payment"),
              inArray(
                accountMovements.referenceId,
                payments.map((p) => p.id),
              ),
            ),
          );
        await lockAccounts(
          tx,
          userId,
          rows.map((r) => r.accountId),
        );
        for (const p of payments)
          await reverseSource(
            tx,
            userId,
            "debt_payment",
            p.id,
            jakartaDate(),
            `Deleted debt payment: ${d.name}`,
          );
      }
      await tx.delete(debts).where(eq(debts.id, id));
    });
    done();
  });
}
export async function recordDebtPayment(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const amount = money.parse(f.get("amount"));
    const selected = accountId.parse(f.get("accountId"));
    const key = requestId.parse(f.get("requestId"));
    const date = z.string().date().parse(f.get("date"));
    const notes = z
      .string()
      .trim()
      .max(1000)
      .parse(f.get("notes") ?? "");
    const userId = await requireOwner();
    const hash = requestHash("debt_payment", {
      id,
      amount,
      selected,
      date,
      notes,
    });
    await db.transaction(async (tx) => {
      const [d] = await tx
        .select()
        .from(debts)
        .where(and(eq(debts.id, id), eq(debts.userId, userId)))
        .for("update");
      if (!d) throw new InputError("Debt no longer exists. Refresh the page.");
      await lockAccounts(tx, userId, [selected]);
      if (await wasApplied(tx, userId, key, hash)) return;
      if (isDebtPaidOff(d)) throw new InputError("Debt is already paid off.");
      await lockAccounts(tx, userId, [selected], [selected]);
      const paid = Math.min(amount, d.remainingAmount);
      const [p] = await tx
        .insert(debtPayments)
        .values({
          userId,
          debtId: id,
          amount: paid,
          principalAmount: paid,
          paidAt: date,
          accountId: selected,
          notes: notes || null,
        })
        .returning();
      await tx
        .update(debts)
        .set({
          remainingAmount: d.remainingAmount - paid,
          status: d.remainingAmount === paid ? "paid" : "active",
        })
        .where(eq(debts.id, id));
      await moveMoney(tx, userId, {
        accountId: selected,
        amount: -paid,
        type: "debt_payment",
        referenceType: "debt_payment",
        referenceId: p.id,
        description: d.name + (notes ? ` · ${notes}` : ""),
        occurredAt: date,
        requestId: key,
        requestHash: hash,
      });
    });
    done();
  });
}
