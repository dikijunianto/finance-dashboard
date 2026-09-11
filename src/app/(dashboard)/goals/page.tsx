import { desc } from "drizzle-orm";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { GoalsPage } from "@/components/goals/goals-page";
import { requireAuth } from "@/lib/auth/require-auth";
export default async function Page() {
  await requireAuth();
  return (
    <GoalsPage
      goals={await db.select().from(goals).orderBy(desc(goals.createdAt))}
    />
  );
}
