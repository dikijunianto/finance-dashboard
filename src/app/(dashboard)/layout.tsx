import { requireAuth } from "@/lib/auth/require-auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) { await requireAuth(); return <DashboardShell>{children}</DashboardShell>; }
