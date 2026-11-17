import Link from "next/link";
import { notFound } from "next/navigation";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { flags } from "@/lib/flags";
import { HOST_TERMS_VERSION } from "@/lib/services/growth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host terms", description: "The rules for hosts and DJs who run parties on We Party, in plain English." };

/*
 * DRAFT FOR LAWYER REVIEW. Written in plain language by the product team.
 * It is not legal advice and has not been reviewed by a lawyer yet.
 * Only shown when FEATURE_TERMS=1.
 */
export default function HostTermsPage() {
  if (!flags.terms) notFound();
  return (
    <InfoPage
      title="Host terms"
      intro={
        <>
          <p>Version {HOST_TERMS_VERSION}. For hosts, DJs and venues who run parties on We Party.</p>
          <p className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100">
            Draft: these terms are written in plain English and are waiting for review by a lawyer. They are not legal advice.
          </p>
        </>
      }
    >
      <InfoSection title="1. What We Party does">
        <p>
          We Party lets your guests scan a QR code, pick songs and heart each other&apos;s picks, so you can see what the room wants.
          We Party does not play, stream, sell or license music. You choose what actually plays and how.
        </p>
      </InfoSection>

      <InfoSection title="2. Music licensing is your responsibility">
        <p>
          Playing music in public (bars, clubs, venues, paid events) usually needs a public performance license, for example
          through ASCAP, BMI, SESAC or GMR in the US, or the equivalent where you are. Personal streaming subscriptions, such as a
          personal Apple Music plan, are generally for personal use only. You (or your venue) are responsible for having the
          right licenses for the music you play.
        </p>
      </InfoSection>

      <InfoSection title="3. Your guests">
        <ul>
          <li>Be fair and respectful. Use the blocklist, approval mode and guest removal to keep your party safe and on-vibe.</li>
          <li>Act on reports from guests when you can. Remove people who harass others.</li>
          <li>Guests share a name, Instagram username and optional photo to join. Only use them to run the party.</li>
          <li>Don&apos;t collect guest information through We Party for anything else, and don&apos;t sell it.</li>
        </ul>
      </InfoSection>

      <InfoSection title="4. Followers and emails">
        <p>
          If guests choose to follow you, you can download their email addresses. Only email them about your upcoming parties,
          include an unsubscribe link in every email, and stop emailing anyone who unsubscribes. Follow the anti-spam laws where
          you and your guests are (for example CAN-SPAM in the US).
        </p>
      </InfoSection>

      <InfoSection title="5. Tips, Song Boosts and plans">
        <ul>
          <li>Payments go through Stripe. You agree to Stripe&apos;s terms when you set up payouts. We never see card numbers.</li>
          <li>We Party keeps a service fee on tips and boosts. The current fee is shown before you turn payouts on.</li>
          <li>You are responsible for your own taxes on money you receive.</li>
          <li>Song Boosts help a song move up, but you still decide what plays. Treat boosted guests fairly.</li>
          <li>Paid plans renew monthly until you cancel. Cancel any time from your host dashboard.</li>
        </ul>
      </InfoSection>

      <InfoSection title="6. Sponsors">
        <p>
          If you show a &ldquo;Presented by&rdquo; sponsor, you confirm you have the sponsor&apos;s permission to use their name and link,
          and that the sponsorship follows the law (for example, rules about alcohol advertising).
        </p>
      </InfoSection>

      <InfoSection title="7. Things you can't do">
        <ul>
          <li>Break the law, or use We Party to harass, threaten or discriminate against anyone.</li>
          <li>Try to break, overload or get around the security of We Party.</li>
          <li>Pretend to be someone else, or run a party in someone else&apos;s name without permission.</li>
        </ul>
      </InfoSection>

      <InfoSection title="8. No guarantees">
        <p>
          We work hard to keep We Party running, but we can&apos;t promise it will always be available or error-free, especially on
          weak venue Wi-Fi. Always have a backup plan for the music. To the extent the law allows, We Party isn&apos;t responsible for
          lost income or other indirect losses if something goes wrong.
        </p>
      </InfoSection>

      <InfoSection title="9. Changes and ending">
        <p>
          We may update these terms. When we do, we&apos;ll show the new version the next time you create an event. You can delete
          your host account any time from your dashboard. We may suspend accounts that break these terms.
        </p>
      </InfoSection>

      <InfoSection title="10. Questions">
        <p>
          See our <Link href="/privacy">privacy policy</Link> or <Link href="/support">contact support</Link>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
