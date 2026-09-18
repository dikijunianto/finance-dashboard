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
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Overview",
  },
  { href: "/accounts", label: "Accounts", icon: Landmark, group: "Money" },
  { href: "/cash-flow", label: "Cash Flow", icon: BarChart3, group: "Money" },
  { href: "/bills", label: "Bills & Debt", icon: CreditCard, group: "Plan" },
  { href: "/budget", label: "Plan", icon: Wallet, group: "Plan" },
  { href: "/goals", label: "Goals", icon: Target, group: "Plan" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "Insights" },
];
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="finance-shell min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="finance-sidebar sticky top-0 hidden h-screen overflow-y-auto px-4 py-7 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-xl bg-ink text-white">
            <CircleDollarSign size={21} />
          </span>
          <span>
            <strong className="block tracking-tight">MyFinance</strong>
            <small className="text-slate-500">Personal CFO</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="mt-9 space-y-6">
          {["Overview", "Money", "Plan", "Insights"].map((group) => (
            <div key={group}>
              <p className="eyebrow mb-2 px-3">{group}</p>
              <div className="space-y-1">
                {links
                  .filter((link) => link.group === group)
                  .map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      aria-current={path === href ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${path === href ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-white/60"}`}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t pt-5">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500"
          >
            <Settings size={17} />
            Settings
          </Link>
          <div className="mt-3 p-3">
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
