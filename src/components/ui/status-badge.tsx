import type { ReactNode } from "react";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "attention" | "danger";
}) {
  const colors = {
    neutral: "bg-slate-100 text-slate-600",
    good: "bg-emerald-50 text-emerald-800",
    attention: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
