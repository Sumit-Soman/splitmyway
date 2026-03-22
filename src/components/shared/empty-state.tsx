import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? <Icon className="mb-3 h-10 w-10 text-neutral-300" /> : null}
      <p className="text-base font-medium text-neutral-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
