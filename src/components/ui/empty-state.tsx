import type { ReactNode } from "react";
import { CircleDollarSign } from "lucide-react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <CircleDollarSign
        aria-hidden="true"
        size={22}
        className="mx-auto mb-3 text-muted"
      />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
