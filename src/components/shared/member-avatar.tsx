import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { getMemberPalette } from "@/lib/member-colors";

export function MemberAvatar({
  userId,
  name,
  email,
  className,
  size = "md",
}: {
  userId: string;
  name: string | null | undefined;
  email: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const p = getMemberPalette(userId);
  const sizeCls = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";

  return (
    <Avatar className={cn("ring-2 ring-offset-2 ring-offset-white", p.ring, sizeCls, className)}>
      <AvatarFallback className={cn("font-semibold", p.fallback)}>{getInitials(name, email)}</AvatarFallback>
    </Avatar>
  );
}

/** Small colored dot for inline labels (e.g. balance rows). */
export function MemberDot({ userId, className }: { userId: string; className?: string }) {
  const p = getMemberPalette(userId);
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", p.dot, className)} aria-hidden />;
}
