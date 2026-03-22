import Link from "next/link";
import { ArrowRight, BarChart3, Bell, Shield, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-[17px] font-semibold tracking-tight text-neutral-900">
            Split<span className="font-bold text-blue-600">MyWay</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
              Login
            </Link>
            <Link href="/signup" className={cn(buttonVariants())}>
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 md:pt-28">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <p className="mb-5 inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-600">
                Fair splits · Live rates · Zero awkwardness
              </p>
              <h1 className="text-[2.125rem] font-semibold leading-[1.12] tracking-tight text-neutral-900 sm:text-5xl sm:leading-[1.1] lg:text-[3.125rem]">
                Split expenses.
                <br />
                <span className="text-neutral-500">Not friendships.</span>
              </h1>
              <p className="prose-marketing mt-7 text-[1.0625rem] leading-[1.7] sm:text-lg">
                Track shared costs across trips, roommates, and nights out. Smart splits, instant balances, and clear
                settlements — in one disciplined workspace.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "inline-flex gap-2")}>
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                  I have an account
                </Link>
              </div>
            </div>
            <div className="relative lg:pl-4">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-neutral-100/80 to-transparent" />
              <Card className="relative overflow-hidden border-neutral-200 shadow-[0_24px_80px_-20px_rgba(15,23,42,0.12)]">
                <CardContent className="p-0">
                  <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                    Dashboard preview
                  </div>
                  <div className="space-y-5 p-6 sm:p-7">
                    <div className="grid grid-cols-3 gap-2">
                      {["Net balance", "Groups", "Pending"].map((label) => (
                        <div key={label} className="rounded-md border border-neutral-100 bg-neutral-50/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
                          <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-neutral-900">—</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border border-neutral-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Recent activity</p>
                      <div className="mt-3.5 space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-2.5 text-sm leading-snug text-neutral-700">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
                            Expense added · Group {i}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-y border-neutral-200 bg-neutral-50 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[1.875rem] sm:leading-snug">
              Built for real life
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-neutral-600">
              Precision and clarity for groups that take shared money seriously.
            </p>
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Users,
                  title: "Smart splitting",
                  body: "Equal, exact, percentage, or shares — with penny-accurate rounding.",
                },
                {
                  icon: Shield,
                  title: "Group management",
                  body: "Roles, invitations, and a clear audit trail for every change.",
                },
                {
                  icon: BarChart3,
                  title: "Instant settlements",
                  body: "Minimized transactions so you settle up in fewer payments.",
                },
                {
                  icon: Bell,
                  title: "Activity feed",
                  body: "See what changed across your groups at a glance.",
                },
              ].map((f) => (
                <Card key={f.title} className="border-neutral-200 bg-white shadow-sm">
                  <CardContent className="p-6 sm:p-7">
                    <f.icon className="h-7 w-7 text-neutral-800" strokeWidth={1.5} />
                    <h3 className="mt-5 text-lg font-semibold leading-snug tracking-tight text-neutral-900">{f.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 sm:text-base">{f.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[1.875rem]">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-neutral-600">
            Three steps from setup to settled.
          </p>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { step: "01", title: "Create a group", body: "Pick a currency and invite friends by email." },
              { step: "02", title: "Add expenses", body: "Split fairly, convert currencies with live rates." },
              { step: "03", title: "Settle up", body: "Record payments and keep balances in sync." },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
                <span className="text-3xl font-light tabular-nums leading-none text-neutral-300">{s.step}</span>
                <h3 className="mt-4 text-lg font-semibold leading-snug text-neutral-900">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 sm:text-base">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-neutral-200 bg-neutral-50 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[1.875rem]">
              Trusted by organizers
            </h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  quote: "Finally replaced the spreadsheet. The split methods are rock solid.",
                  name: "Alex R.",
                  role: "Trip lead",
                },
                {
                  quote: "Currency conversion locked at creation time — exactly what we needed abroad.",
                  name: "Mina K.",
                  role: "Remote team",
                },
                {
                  quote: "Settlement suggestions save us from endless back-and-forth.",
                  name: "Jordan P.",
                  role: "Roommates",
                },
              ].map((t) => (
                <Card key={t.name} className="border-neutral-200 bg-white shadow-sm">
                  <CardContent className="p-6 sm:p-7">
                    <p className="text-[15px] leading-[1.65] text-neutral-700 sm:text-base">&ldquo;{t.quote}&rdquo;</p>
                    <p className="mt-6 text-sm font-semibold text-neutral-900">{t.name}</p>
                    <p className="mt-1 text-sm text-neutral-500">{t.role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900 px-6 py-14 text-center shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] sm:px-10 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.875rem] sm:leading-snug">
              Ready to split smarter?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-400">
              Create your account in seconds. No credit card required.
            </p>
            <div className="mt-9 flex justify-center">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-white text-neutral-900 hover:bg-neutral-100"
                )}
              >
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <p className="text-neutral-600">© {new Date().getFullYear()} SplitMyWay</p>
          <div className="flex gap-8">
            <Link href="/login" className="text-neutral-600 transition-colors hover:text-neutral-900">
              Login
            </Link>
            <Link href="/signup" className="text-neutral-600 transition-colors hover:text-neutral-900">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
