"use client";

import * as React from "react";
import { Search, UserPlus, X } from "lucide-react";
import { searchGroupMemberCandidates, type MemberSearchHit } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberAvatar, MemberName } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddMemberPicker({
  groupId,
  formAction,
  pending,
}: {
  groupId: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const { toast } = useToast();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<MemberSearchHit[]>([]);
  const [selected, setSelected] = React.useState<MemberSearchHit | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");

  const effectiveEmail = (selected?.email ?? inviteEmail).trim().toLowerCase();

  React.useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchGroupMemberCandidates(groupId, query);
          setResults(rows);
          setOpen(true);
        } catch {
          setResults([]);
          setOpen(false);
        } finally {
          setLoading(false);
        }
      })();
    }, 280);

    return () => window.clearTimeout(handle);
  }, [query, groupId]);

  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function pickUser(hit: MemberSearchHit) {
    setSelected(hit);
    setInviteEmail("");
    setQuery("");
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
  }

  function clearSelection() {
    setSelected(null);
  }

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(e) => {
        const em = effectiveEmail;
        if (!em || !EMAIL_RE.test(em)) {
          e.preventDefault();
          toast({
            title: "Add a member",
            description: "Choose someone from search or enter a valid email to invite.",
            variant: "destructive",
          });
        }
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="email" value={effectiveEmail} readOnly />

      <div ref={containerRef} className="relative space-y-2">
        <Label htmlFor="member-search" className="text-sm font-medium text-neutral-800">
          Find by first name
        </Label>
        <p className="text-xs leading-relaxed text-neutral-500">
          Type at least three letters of their <span className="font-medium text-neutral-600">first name</span>, then
          pick them from the list.
        </p>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            strokeWidth={2}
            aria-hidden
          />
          <Input
            ref={inputRef}
            id="member-search"
            type="text"
            autoComplete="off"
            placeholder="e.g. Sam, Maria…"
            value={query}
            disabled={pending}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) setSelected(null);
            }}
            onFocus={() => {
              if (results.length > 0 && query.trim().length >= 3) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            className={cn("h-11 pl-9 pr-3", loading && "pr-10")}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="member-search-results"
          />
          {loading ? (
            <span
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-pulse rounded-full bg-neutral-300"
              aria-hidden
            />
          ) : null}
        </div>

        {open && query.trim().length >= 3 ? (
          <ul
            id="member-search-results"
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-neutral-200/90 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          >
            {results.length === 0 && !loading ? (
              <li className="px-3 py-3 text-sm text-neutral-500" role="presentation">
                No one matches that first name. Try another spelling, or invite by email below.
              </li>
            ) : (
              results.map((hit) => (
                <li key={hit.id} role="option">
                  <button
                    type="button"
                    disabled={pending}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickUser(hit)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
                  >
                    <MemberAvatar
                      userId={hit.id}
                      name={hit.name}
                      email={hit.email}
                      avatarUrl={hit.avatarUrl}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <MemberName userId={hit.id} className="truncate text-sm font-medium">
                        {hit.name ?? hit.email}
                      </MemberName>
                      <p className="truncate text-xs text-neutral-500">{hit.email}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <MemberAvatar
              userId={selected.id}
              name={selected.name}
              email={selected.email}
              avatarUrl={selected.avatarUrl}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">Selected</p>
              <MemberName userId={selected.id} className="truncate text-sm font-medium">
                {selected.name ?? selected.email}
              </MemberName>
              <p className="truncate text-xs text-neutral-600">{selected.email}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-neutral-500 hover:text-neutral-900"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-neutral-100 pt-4">
        <Label htmlFor="invite-email" className="flex items-center gap-2 text-sm font-medium text-neutral-800">
          <UserPlus className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
          Or invite by email
        </Label>
        <p className="text-xs text-neutral-500">
          If they don&apos;t have an account yet, we&apos;ll save an invitation for that address.
        </p>
        <Input
          id="invite-email"
          type="email"
          autoComplete="email"
          placeholder="friend@email.com"
          value={inviteEmail}
          disabled={pending || !!selected}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="h-11"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}
