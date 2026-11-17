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

      <InfoSection title="5. Price">
        <p>
          We Party is free to use right now. If we ever add paid features, we&apos;ll tell you first and nothing will be charged
          without your clear agreement.
        </p>
      </InfoSection>

      <InfoSection title="6. Things you can't do">
        <ul>
          <li>Break the law, or use We Party to harass, threaten or discriminate against anyone.</li>
          <li>Try to break, overload or get around the security of We Party.</li>
          <li>Pretend to be someone else, or run a party in someone else&apos;s name without permission.</li>
        </ul>
      </InfoSection>

      <InfoSection title="7. No guarantees">
        <p>
          We work hard to keep We Party running, but we can&apos;t promise it will always be available or error-free, especially on
          weak venue Wi-Fi. Always have a backup plan for the music. To the extent the law allows, We Party isn&apos;t responsible for
          lost income or other indirect losses if something goes wrong.
        </p>
      </InfoSection>

      <InfoSection title="8. Changes and ending">
        <p>
          We may update these terms. When we do, we&apos;ll show the new version the next time you create an event. You can delete
          your host account any time from your dashboard. We may suspend accounts that break these terms.
        </p>
      </InfoSection>

      <InfoSection title="9. Questions">
        <p>
          See our <Link href="/privacy">privacy policy</Link> or <Link href="/support">contact support</Link>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
