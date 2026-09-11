import { desc } from "drizzle-orm";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { GoalsPage } from "@/components/goals/goals-page";
export default async function Page(){return <GoalsPage goals={await db.select().from(goals).orderBy(desc(goals.createdAt))}/>}
