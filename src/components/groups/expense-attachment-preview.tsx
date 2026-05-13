"use client";

import { ExternalLink, Paperclip } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

/**
 * Opens the receipt via `fetch` + blob URL so the session cookie is always sent
 * (some environments are flaky with `target=_blank` navigations to `/api/*`).
 * Modifier-key clicks keep default `<a>` behavior (new tab navigation to the same URL).
 */
export function ExpenseAttachmentPreview({
  expenseId,
  fileName,
  className,
}: {
  expenseId: string;
  fileName: string | null | undefined;
  className?: string;
}) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);
  const href = `/api/expenses/${encodeURIComponent(expenseId)}/attachment`;

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (opening) return;
      setOpening(true);
      try {
        const res = await fetch(href, { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          const msg =
            res.status === 401
              ? "Sign in to view this attachment."
              : res.status === 403
                ? "You cannot access this attachment."
                : res.status === 404
                  ? "Attachment not found."
                  : "Could not open attachment.";
          toast({ title: "Attachment", description: msg, variant: "destructive" });
          return;
        }
        const blob = await res.blob();
        if (blob.size === 0) {
          toast({
            title: "Attachment",
            description: "The file is empty or could not be loaded.",
            variant: "destructive",
          });
          return;
        }
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          URL.revokeObjectURL(url);
          toast({
            title: "Attachment",
            description: "Allow pop-ups for this site, or use right‑click → Open in new tab.",
            variant: "destructive",
          });
          return;
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } catch {
        toast({
          title: "Attachment",
          description: "Could not open attachment.",
          variant: "destructive",
        });
      } finally {
        setOpening(false);
      }
    },
    [href, opening, toast]
  );

  if (!fileName?.trim()) return null;

  return (
    <div className={cn("mt-2.5", className)}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Attachment</p>
      <a
        href={href}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full min-w-0 items-center gap-2 text-[11px] font-medium text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
        aria-busy={opening}
      >
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
        <span className="min-w-0 truncate">{opening ? "Opening…" : fileName}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    </div>
  );
}
