import Link from "next/link";
import { redirect } from "next/navigation";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { unsubscribe } from "@/lib/services/growth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false } };

type Props = { searchParams: Promise<{ t?: string; done?: string; bad?: string }> };

async function confirm(form: FormData) {
  "use server";
  const ok = await unsubscribe(String(form.get("t") ?? ""));
  redirect(ok ? "/unsubscribe?done=1" : "/unsubscribe?bad=1");
}

/**
 * Unsubscribe from "Follow this DJ/host" emails. It takes a button press
 * (not just opening the link) so email link scanners can't unsubscribe people.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { t, done, bad } = await searchParams;
  if (done) {
    return (
      <InfoPage title="You're unsubscribed">
        <InfoSection title="Done">
          <p>You won&apos;t get any more emails about this host&apos;s parties. You can follow them again from any of their replay pages.</p>
        </InfoSection>
      </InfoPage>
    );
  }
  if (bad || !t) {
    return (
      <InfoPage title="Unsubscribe">
        <InfoSection title="That link didn't work">
          <p>
            The unsubscribe link is missing or has expired. Use the link from your most recent email, or{" "}
            <Link href="/support">contact support</Link> and we&apos;ll remove you.
          </p>
        </InfoSection>
      </InfoPage>
    );
  }
  return (
    <InfoPage title="Unsubscribe">
      <InfoSection title="Stop emails from this host?">
        <form action={confirm}>
          <input type="hidden" name="t" value={t} />
          <button className="btn btn-primary min-h-12 w-full">Unsubscribe</button>
        </form>
      </InfoSection>
    </InfoPage>
  );
}
