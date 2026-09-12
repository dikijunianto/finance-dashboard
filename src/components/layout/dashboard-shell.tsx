"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Landmark,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import { logout } from "@/actions/auth";
const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/cash-flow", label: "Cash Flow", icon: BarChart3 },
  { href: "/bills", label: "Bills & Debt", icon: CreditCard },
  { href: "/budget", label: "Plan", icon: Wallet },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-[#f6f8f6] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-screen border-r border-emerald-950/5 bg-white px-4 py-6 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
            <CircleDollarSign size={21} />
          </span>
          <span>
            <strong className="block tracking-tight">MyFinance</strong>
            <small className="text-slate-500">Your Personal CFO</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="mt-10 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${path === href ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-5">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500"
          >
            <Settings size={17} />
            Settings
          </Link>
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <strong className="text-sm">MyFinance</strong>
            <p className="text-xs text-slate-500">Private account</p>
            <form action={logout}>
              <button className="mt-3 text-xs font-semibold text-rose-600">
                Logout
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200/70 bg-white px-5 py-4 lg:hidden">
          <strong className="flex items-center gap-2">MyFinance</strong>
          <form action={logout}>
            <button className="text-sm text-rose-600">Logout</button>
          </form>
        </header>
        <nav
          aria-label="Mobile navigation"
          className="flex flex-wrap gap-1 border-b bg-white p-3 lg:hidden"
        >
          {[
            ...links,
            { href: "/settings", label: "Settings", icon: Settings },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm ${path === href ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
