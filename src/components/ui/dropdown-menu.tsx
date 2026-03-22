"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownCtx = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <DropdownCtx.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownCtx.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(DropdownCtx);
  return (
    <div
      className={cn(className)}
      onClick={() => ctx?.setOpen(!ctx.open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") ctx?.setOpen(!ctx?.open);
      }}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const ctx = React.useContext(DropdownCtx);
  if (!ctx?.open) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-2 min-w-[12rem] rounded-md border border-neutral-200 bg-white py-1 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.12)]",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ctx = React.useContext(DropdownCtx);
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50",
        className
      )}
      onClick={() => {
        onClick?.();
        ctx?.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}
