"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const value = React.useMemo(() => ({ open, setOpen: onOpenChange }), [open, onOpenChange]);
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(DialogContext);
  return (
    <button type="button" onClick={() => ctx?.setOpen(true)}>
      {children}
    </button>
  );
}

export function DialogContent({
  className,
  children,
  title,
  description,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const ctx = React.useContext(DialogContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!ctx?.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ctx.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx?.open, ctx]);

  if (!ctx?.open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="animate-fade-in fixed inset-0 bg-neutral-900/25 backdrop-blur-[2px]"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          "animate-scale-in relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)]",
          className
        )}
      >
        {title ? (
          <h2 id="dialog-title" className="text-lg font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
        ) : null}
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
        <div className={cn(title || description ? "mt-4" : "")}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
