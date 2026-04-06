"use client";

import { ExternalLink, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExpenseAttachmentPreview({
  expenseId,
  fileName,
  className,
}: {
  expenseId: string;
  fileName: string | null | undefined;
  className?: string;
}) {
  const href = `/api/expenses/${expenseId}/attachment`;

  if (!fileName?.trim()) return null;

  return (
    <div className={cn("mt-2.5", className)}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Attachment</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full min-w-0 items-center gap-2 text-[11px] font-medium text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
        <span className="min-w-0 truncate">{fileName}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    </div>
  );
}
