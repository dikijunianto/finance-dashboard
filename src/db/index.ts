import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
// Connection stays lazy; missing local env fails only when a database request is made.
export const db = drizzle(postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/myfinance", { prepare: false }), { schema });
