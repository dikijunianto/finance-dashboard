"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { validCredentials } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
export type LoginState = { error?: string };
export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !await validCredentials(parsed.data.username, parsed.data.password)) return { error: "Invalid username or password." };
  await createSession(parsed.data.username);
  redirect("/dashboard");
}
export async function logout() { await deleteSession(); redirect("/login"); }
