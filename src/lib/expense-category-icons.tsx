import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Building2,
  Bus,
  Car,
  CircleDollarSign,
  CircleParking,
  Clapperboard,
  Coffee,
  HeartPulse,
  MoreHorizontal,
  Mountain,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  general: CircleDollarSign,
  food: UtensilsCrossed,
  groceries: ShoppingBasket,
  drinks: Coffee,
  hotel: Building2,
  flight: Plane,
  cab: Car,
  transport: Bus,
  parking: CircleParking,
  activities: Mountain,
  entertainment: Clapperboard,
  shopping: ShoppingBag,
  utilities: Zap,
  health: HeartPulse,
  fees: BadgePercent,
  other: MoreHorizontal,
};

const CATEGORY_CHIP: Record<string, string> = {
  general: "bg-slate-100 text-slate-700 border-slate-200/80",
  food: "bg-orange-50 text-orange-800 border-orange-200/80",
  groceries: "bg-lime-50 text-lime-900 border-lime-200/80",
  drinks: "bg-amber-50 text-amber-900 border-amber-200/80",
  hotel: "bg-violet-50 text-violet-900 border-violet-200/80",
  flight: "bg-sky-50 text-sky-900 border-sky-200/80",
  cab: "bg-indigo-50 text-indigo-900 border-indigo-200/80",
  transport: "bg-blue-50 text-blue-900 border-blue-200/80",
  parking: "bg-neutral-100 text-neutral-800 border-neutral-200/80",
  activities: "bg-teal-50 text-teal-900 border-teal-200/80",
  entertainment: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200/80",
  shopping: "bg-pink-50 text-pink-900 border-pink-200/80",
  utilities: "bg-yellow-50 text-yellow-900 border-yellow-200/80",
  health: "bg-red-50 text-red-900 border-red-200/80",
  fees: "bg-emerald-50 text-emerald-900 border-emerald-200/80",
  other: "bg-neutral-50 text-neutral-700 border-neutral-200/80",
};

export function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function ExpenseCategoryIcon({
  category,
  className,
  strokeWidth = 2,
}: {
  category: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Sparkles;
  return <Icon className={cn("shrink-0", className)} strokeWidth={strokeWidth} aria-hidden />;
}

export function expenseCategoryChipClass(category: string): string {
  return CATEGORY_CHIP[category] ?? CATEGORY_CHIP.other!;
}
