import { z } from "zod";
const money = z.coerce.number().int().min(0, "Nominal tidak boleh negatif");
export const billSchema = z.object({ name: z.string().min(2), category: z.string().min(2), amount: money, dueDay: z.coerce.number().int().min(1).max(31), frequency: z.enum(["monthly", "yearly"]) });
export const debtSchema = z.object({ name: z.string().min(2), lender: z.string().min(2), remainingAmount: money, installmentAmount: money, dueDay: z.coerce.number().int().min(1).max(31) });
export const goalSchema = z.object({ name: z.string().min(2), targetAmount: money, currentAmount: money, targetDate: z.string().min(1) });
export const noteSchema = z.object({ content: z.string().min(2).max(1000), category: z.string().min(2) });
