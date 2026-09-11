import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
export type ActionResult =
  { success: true } | { success: false; error: string };
export class InputError extends Error {}
// Only explicitly safe validation messages leave the server.
export async function mutationResult(
  work: () => Promise<void>,
): Promise<ActionResult> {
  await requireAuth();
  try {
    await work();
    return { success: true };
  } catch (error) {
    if (error instanceof InputError)
      return { success: false, error: error.message };
    if (error instanceof z.ZodError)
      return {
        success: false,
        error: "Check the required fields, dates and whole-Rupiah amounts.",
      };
    console.error("Finance mutation failed. Database details withheld.");
    return {
      success: false,
      error:
        "Could not confirm this change. Refresh to check its status before retrying.",
    };
  }
}
export async function requireOwner() {
  await requireAuth();
  const email = "local@myfinance.private";
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (existing) return existing.id;
  await db
    .insert(user)
    .values({ email, name: "MyFinance owner", emailVerified: true })
    .onConflictDoNothing({ target: user.email });
  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return owner.id;
}
