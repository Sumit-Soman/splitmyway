import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">404</h1>
      <p className="max-w-sm text-center text-base leading-relaxed text-neutral-600">
        This page could not be found.
      </p>
      <Link href="/" className={cn(buttonVariants())}>
        Go home
      </Link>
    </div>
  );
}
