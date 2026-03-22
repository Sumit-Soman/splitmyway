"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastMessage = { id: string; title?: string; description?: string; variant?: "default" | "destructive" };

type ToastContextValue = {
  toasts: ToastMessage[];
  toast: (t: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((t: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto slide-in-from-right rounded-md border px-4 py-3 shadow-lg",
              t.variant === "destructive"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-neutral-200 bg-white text-neutral-900 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
            )}
          >
            {t.title ? <p className="text-sm font-semibold">{t.title}</p> : null}
            {t.description ? <p className="text-sm text-neutral-600">{t.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
