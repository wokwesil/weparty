import Link from "next/link";
import { notFound } from "next/navigation";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { flags } from "@/lib/flags";
import { formatMoney, plans } from "@/lib/payments/config";
import { getHostAccount, listHostEventsForBilling } from "@/lib/services/billing";
import { currentHostId } from "@/lib/session";
import { UpgradeButton } from "./UpgradeButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

/** Plans and upgrade (only visible when FEATURE_PLANS=1). */
export default async function PricingPage() {
  if (!flags.plans) notFound();
  const hostId = await currentHostId();
  const account = hostId ? await getHostAccount(hostId) : null;
  const org = account?.orgs.find((o) => o.role !== "dj") ?? null;
  const events = hostId && org ? await listHostEventsForBilling(hostId, org.id) : [];

  return (
    <main className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-16 pt-4">
      <Backdrop />
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="tap"><Wordmark size="sm" /></Link>
        <Link href={hostId ? "/host" : "/host/login"} className="min-h-11 py-3 text-sm text-muted hover:text-white">
          {hostId ? "Your parties →" : "Host sign in →"}
        </Link>
      </header>
      <section className="mt-8 text-center">
        <h1 className="font-display text-4xl font-black">
          Pick your <span className="text-gradient">plan</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">Free for small parties. Upgrade when the room gets bigger. Payments happen securely on this website through Stripe.</p>
      </section>
      <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans().map((p) => {
          const current = org && ((p.id === "free" && org.plan === "free") || (p.id === "dj_pro" && (org.plan === "dj_pro" || org.plan === "pro")) || (p.id === "venue" && org.plan === "venue"));
          return (
            <div key={p.id} className={`glass flex flex-col rounded-3xl p-5 ${p.id === "dj_pro" ? "ring-2 ring-pink/60" : ""}`}>
              <p className="font-display text-xl font-black">{p.name}</p>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-3xl font-black">{p.priceCents ? formatMoney(p.priceCents) : "$0"}</span>
                <span className="text-sm text-muted">{p.interval === "month" ? " / month" : p.interval === "once" ? " one time" : ""}</span>
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-lime" aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {current ? (
                  <p className="rounded-full bg-white/10 py-3 text-center text-sm font-semibold">Your plan</p>
                ) : p.id === "free" ? (
                  <Link href="/host/signup" className="btn btn-ghost min-h-12 w-full">Start free</Link>
                ) : org ? (
                  <UpgradeButton orgId={org.id} plan={p.id} events={p.id === "event_pass" ? events : undefined} label={`Get ${p.name}`} />
                ) : (
                  <Link href="/host/signup" className="btn btn-primary min-h-12 w-full">Sign up to upgrade</Link>
                )}
              </div>
            </div>
          );
        })}
      </section>
      <p className="mt-8 text-center text-xs text-muted">Prices in US dollars. Cancel monthly plans any time from your host dashboard.</p>
      <div className="mt-6 flex justify-center">
        <PoweredBy />
      </div>
    </main>
  );
}
