"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { getMemberPalette } from "@/lib/member-colors";

export function MemberAvatar({
  userId,
  name,
  email = "",
  avatarUrl,
  className,
  size = "md",
}: {
  userId: string;
  name: string | null | undefined;
  email?: string;
  avatarUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const p = getMemberPalette(userId);
  const sizeCls = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const showPhoto = Boolean(avatarUrl?.trim()) && !imgFailed;

  return (
    <Avatar className={cn("ring-2 ring-offset-2 ring-offset-white", p.ring, sizeCls, className)}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote user avatars; sizes are fixed
        <img
          key={avatarUrl}
          src={avatarUrl!.trim()}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <AvatarFallback className={cn("font-semibold", p.fallback)}>{getInitials(name, email)}</AvatarFallback>
      )}
    </Avatar>
  );
}

/** Small colored dot for inline labels (e.g. balance rows). */
export function MemberDot({ userId, className }: { userId: string; className?: string }) {
  const p = getMemberPalette(userId);
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", p.dot, className)} aria-hidden />;
}

/** Consistent hue for a member’s display name (pairs with MemberDot / MemberAvatar). */
export function MemberName({
  userId,
  children,
  className,
  as: Tag = "span",
}: {
  userId: string;
  children: ReactNode;
  className?: string;
  as?: "span" | "strong";
}) {
  const p = getMemberPalette(userId);
  const Comp = Tag;
  return <Comp className={cn(p.nameText, className)}>{children}</Comp>;
}
