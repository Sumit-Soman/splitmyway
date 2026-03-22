"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "danger" | "warning" | "info";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "info",
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  const Icon = variant === "danger" ? Trash2 : variant === "warning" ? AlertTriangle : Info;
  const iconWrap =
    variant === "danger"
      ? "bg-red-50 text-red-700"
      : variant === "warning"
        ? "bg-neutral-100 text-neutral-700"
        : "bg-neutral-100 text-neutral-600";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="animate-fade-in fixed inset-0 bg-neutral-900/25 backdrop-blur-[2px]"
        onClick={() => !loading && onOpenChange(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-scale-in relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)]"
      >
        <div className="flex gap-4">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", iconWrap)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-relaxed text-neutral-600">{description}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={variant === "danger" ? "destructive" : "default"}
                disabled={loading}
                onClick={async () => {
                  await onConfirm();
                }}
              >
                {loading ? "Please wait…" : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
