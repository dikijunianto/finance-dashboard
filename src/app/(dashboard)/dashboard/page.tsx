import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboardData } from "@/lib/dashboard/data";
export default async function DashboardPage() { return <Dashboard data={await getDashboardData()} />; }
