"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { billPayments, bills, debtPayments, debts } from "@/db/schema";
import { InputError, mutationResult, requireOwner } from "@/lib/action-result";
import { billDueDate, currentMonth, jakartaDate } from "@/lib/dates";
import { isDebtPaidOff } from "@/lib/finance/calculations";
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
    const deleted = await db
      .delete(bills)
      .where(and(eq(bills.id, id), eq(bills.userId, userId)))
      .returning({ id: bills.id });
    if (!deleted.length)
      throw new InputError("Bill no longer exists. Refresh the page.");
    done();
  });
}
export async function markBillPaid(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const userId = await requireOwner();
    const [b] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, id), eq(bills.userId, userId)));
    if (!b || !b.isActive)
      throw new InputError("Bill is not active. Refresh the page.");
    const { start } = currentMonth();
    await db
      .insert(billPayments)
      .values({
        userId,
        billId: id,
        billingMonth: start,
        amount: b.amount,
        dueDate: billDueDate(start, b.dueDay),
        paidAt: new Date(),
        status: "paid",
      })
      .onConflictDoUpdate({
        target: [billPayments.billId, billPayments.billingMonth],
        set: { paidAt: new Date(), status: "paid" },
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
    const deleted = await db
      .delete(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning({ id: debts.id });
    if (!deleted.length)
      throw new InputError("Debt no longer exists. Refresh the page.");
    done();
  });
}
export async function recordDebtPayment(f: FormData) {
  return mutationResult(async () => {
    const id = z.string().uuid().parse(f.get("id"));
    const amount = money.parse(f.get("amount"));
    const userId = await requireOwner();
    await db.transaction(async (tx) => {
      const [d] = await tx
        .select()
        .from(debts)
        .where(and(eq(debts.id, id), eq(debts.userId, userId)))
        .for("update");
      if (!d) throw new InputError("Debt no longer exists. Refresh the page.");
      if (isDebtPaidOff(d)) throw new InputError("Debt is already paid off.");
      const paid = Math.min(amount, d.remainingAmount);
      await tx
        .insert(debtPayments)
        .values({
          userId,
          debtId: id,
          amount: paid,
          principalAmount: paid,
          paidAt: jakartaDate(),
        });
      await tx
        .update(debts)
        .set({
          remainingAmount: d.remainingAmount - paid,
          status: d.remainingAmount === paid ? "paid" : "active",
        })
        .where(eq(debts.id, id));
    });
    done();
  });
}
