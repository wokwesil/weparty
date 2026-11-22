import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { HOST_TERMS_VERSION } from "@/lib/services/growth";

export const metadata = {
  title: "Terms & Conditions",
  description: "The rules for using We Party, for guests and hosts, in plain English.",
};

/*
 * Written in plain English by the product team. Not legal advice; William
 * plans to have a lawyer review it. Bump HOST_TERMS_VERSION when it changes.
 */
export default function TermsPage() {
  const updated = new Date(`${HOST_TERMS_VERSION}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <InfoPage
      title="Terms & Conditions"
      intro={
        <>
          <p>Last updated {updated}.</p>
          <p className="mt-3">
            These terms apply to everyone who uses We Party: guests who join a party, and hosts, DJs and venues who run one. By
            using the website or the apps, you agree to them. Please also read our <Link href="/privacy" className="underline">privacy policy</Link>.
          </p>
        </>
      }
    >
      <InfoSection title="1. What We Party is">
        <p>
          We Party is a social music queue for parties. Guests scan a QR code or enter a party code, pick songs and heart each
          other&apos;s picks, so the host can see what the room wants. We Party does not play, stream, sell or license music. The
          host chooses what actually plays and how.
        </p>
      </InfoSection>

      <InfoSection title="2. Who can use it">
        <ul>
          <li>You must be at least 13 years old. If you&apos;re under the age of adulthood where you live, get a parent or guardian&apos;s okay first.</li>
          <li>Hosts must be at least 18 and able to agree to these terms (or have permission to agree for their venue or company).</li>
          <li>Follow the house rules of the party and venue you&apos;re at.</li>
        </ul>
      </InfoSection>

      <InfoSection title="3. Your profile and what you post">
        <ul>
          <li>
            To join a party you share an Instagram username, an optional display name and an optional photo. Use your own. Don&apos;t
            pretend to be someone else.
          </li>
          <li>
            Your name, username, photo and song picks are shown to everyone at that party and on the party&apos;s replay page. You
            give We Party permission to show them there, only to run the party and its replay.
          </li>
          <li>You can leave a party and delete your info from it at any time from the party screen.</li>
          <li>Don&apos;t upload photos you don&apos;t have the right to use, or anything nude, violent or hateful.</li>
        </ul>
      </InfoSection>

      <InfoSection title="4. Be respectful: things you can't do">
        <ul>
          <li>Break the law, or use We Party to harass, bully, threaten or discriminate against anyone.</li>
          <li>Post or request content meant to offend, or spam the queue or shoutouts.</li>
          <li>Try to break, overload, scrape or get around the security or limits of We Party.</li>
          <li>Run a party in someone else&apos;s name, or use We Party for anything other than running and enjoying parties.</li>
        </ul>
        <p>Hosts can remove guests and songs. We can remove content and suspend accounts that break these rules.</p>
      </InfoSection>

      <InfoSection title="5. Extra rules for hosts, DJs and venues">
        <ul>
          <li>
            <b>Music licensing is your responsibility.</b> Playing music in public (bars, clubs, venues, paid events) usually needs a
            public performance license, for example through ASCAP, BMI, SESAC or GMR in the US, or the equivalent where you are.
            Personal streaming plans, such as a personal Apple Music subscription, are generally for personal use only.
          </li>
          <li>
            Keep your party safe and fair. Use the blocklist, approval mode and guest removal, and act on reports from guests when
            you can.
          </li>
          <li>Only use guest information to run your party. Don&apos;t collect it for anything else, and never sell it.</li>
          <li>
            If guests choose to follow you, only email them about your upcoming parties, include an unsubscribe link in every email,
            and follow anti-spam laws (such as CAN-SPAM in the US).
          </li>
          <li>You&apos;re responsible for what happens at your event and for anyone you add as a co-host or DJ.</li>
        </ul>
      </InfoSection>

      <InfoSection title="6. Price">
        <p>
          We Party is free to use right now. If we ever add paid features, we&apos;ll tell you first, and nothing will be charged
          without your clear agreement.
        </p>
      </InfoSection>

      <InfoSection title="7. Other services">
        <p>
          Song search uses Apple Music, and usernames link to Instagram. Those services have their own terms and privacy
          policies, and we aren&apos;t responsible for them. Song titles, artwork and music belong to their owners.
        </p>
      </InfoSection>

      <InfoSection title="8. Our name and app">
        <p>
          The We Party name, logo, design and software belong to We Party. You may share party links, QR codes, replays and
          story images. Please don&apos;t copy the app or use our name or logo in a way that suggests we endorse you.
        </p>
      </InfoSection>

      <InfoSection title="9. No guarantees">
        <p>
          We work hard to keep We Party running, but we can&apos;t promise it will always be available, fast or error-free,
          especially on busy venue Wi-Fi. We Party is provided &quot;as is&quot;. Hosts should always have a backup plan for the
          music. To the extent the law allows, We Party isn&apos;t responsible for indirect losses (such as lost income or a party
          that didn&apos;t go to plan), and our total responsibility to you is limited to $100 or what you paid us in the last 12
          months, whichever is more.
        </p>
      </InfoSection>

      <InfoSection title="10. Ending your use">
        <p>
          You can stop using We Party at any time. Guests can delete their info from a party; hosts can delete their account from
          the host dashboard. We may suspend or remove accounts, parties or content that break these terms or the law.
        </p>
      </InfoSection>

      <InfoSection title="11. Changes to these terms">
        <p>
          We may update these terms as We Party grows. We&apos;ll change the date at the top, and for big changes we&apos;ll let
          hosts know in the app. If you keep using We Party after a change, you accept the new terms.
        </p>
      </InfoSection>

      <InfoSection title="12. Questions">
        <p>
          Read our <Link href="/privacy">privacy policy</Link> or <Link href="/support">contact support</Link>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
