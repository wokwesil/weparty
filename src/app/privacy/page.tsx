import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { POLICY_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Privacy policy",
  description: "What We Party collects, why, who can see it, and how to delete it.",
};

function Contact() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  ) : (
    <Link href="/support">our support page</Link>
  );
}

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy policy"
      intro={
        <>
          <p>Last updated {POLICY_UPDATED}.</p>
          <p className="mt-2">
            We Party is a party music app: guests scan a QR code, pick songs and heart each other&apos;s picks, and the host runs the
            queue. This page explains, in plain English, what we collect and why. It applies to the website and the We Party apps for
            iPhone and Android.
          </p>
        </>
      }
    >
      <InfoSection title="The short version">
        <ul>
          <li>Guests don&apos;t need an account or password. You give a name and your Instagram username to join a party.</li>
          <li>We only collect what the party needs to work. No ads, no tracking across other apps or websites, no selling your data.</li>
          <li>You can delete your info from a party at any time, and hosts can delete their account at any time.</li>
        </ul>
      </InfoSection>

      <InfoSection title="What we collect from guests">
        <ul>
          <li>
            <b>Your name</b> and <b>Instagram username</b>, which you type when you join a party. We don&apos;t connect to your
            Instagram account or read anything from it; the username is just shown so people at the party can find you.
          </li>
          <li>
            <b>A profile photo</b>, only if you add one. It is shrunk on your phone to a small square before it is uploaded.
          </li>
          <li>
            <b>Your party activity</b>: the songs you pick, the songs you heart, and when you joined and were last active.
          </li>
          <li>
            <b>A private party key</b> stored as a cookie on your device so you stay signed in to that party. We only keep a scrambled
            (hashed) copy of it.
          </li>
          <li>
            <b>Your email</b>, only if you choose to follow a host or DJ. We share it with that host so they can tell you about their
            next party, together with when you followed and from which party. Every email must let you unsubscribe, and you can
            unsubscribe any time. We don&apos;t send push notifications.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="What we collect from hosts">
        <ul>
          <li>Email address, display name and team or venue name.</li>
          <li>Your password, stored only as a one-way scrambled hash. We can never see it.</li>
          <li>The events you create (name, venue, date, notes, settings) and a log of host actions such as skipping or removing songs.</li>
          <li>A sign-in cookie that keeps you signed in for up to 30 days.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Information collected automatically">
        <ul>
          <li>
            Your IP address is used briefly to stop abuse (for example, too many sign-in attempts). It is kept in a short-lived
            counter, not linked to your profile.
          </li>
          <li>Our hosting provider keeps standard server logs (such as IP address, browser type and pages requested) for security.</li>
          <li>
            Your device remembers small settings, such as whether you closed the &quot;Install We Party&quot; tip. These stay on your
            device.
          </li>
          <li>The iPhone and Android apps only use the camera when you tap &quot;Scan party QR&quot; or add a photo. Nothing from the camera is stored except a photo you choose to upload.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Who can see your information">
        <ul>
          <li>
            <b>Everyone at the same party</b> sees your name, Instagram username, photo, the songs you picked and how many hearts they
            got.
          </li>
          <li>
            <b>The host of that party</b> (and any co-hosts or DJs they add) sees the guest list and the party&apos;s activity, and can
            remove guests and songs.
          </li>
          <li>
            <b>After the party</b>, the replay page shows the songs that played and who picked them, plus the people who came. Anyone
            with the party link can open it. Hosts can switch off showing people on the replay in the party settings.
          </li>
          <li>Other parties never see your info. Each party is separate.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Services we use">
        <ul>
          <li><b>Vercel</b> hosts the website and apps&apos; content.</li>
          <li><b>Supabase</b> stores the database and sends &quot;the queue changed&quot; signals so screens update live. Those signals contain no personal information.</li>
          <li>
            <b>Apple Music</b> powers song search. Your search words are sent to Apple to find songs. If you choose to connect Apple
            Music (for example, to save a replay playlist), you sign in on Apple&apos;s own page; We Party never sees your Apple
            password, and your Apple Music sign-in stays in your browser.
          </li>
          <li>Tapping an Instagram username opens Instagram, which has its own privacy policy.</li>
        </ul>
        <p>We do not use advertising or analytics companies, and we do not sell or rent personal information.</p>
      </InfoSection>

      <InfoSection title="How long we keep it">
        <ul>
          <li>Party data stays until the host deletes the event or their account, so the replay keeps working.</li>
          <li>You can delete your own info from a party at any time (see below).</li>
          <li>When a host deletes their account, events they ran alone are deleted with all their guests, songs and hearts.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Your choices and how to delete your data">
        <ul>
          <li>
            <b>Guests:</b> open the party, tap your photo (top right), then <b>Leave party and delete my info</b>. This removes your
            profile, photo, hearts and song picks from that party straight away. You can also edit your name, Instagram and photo there.
          </li>
          <li>
            <b>Hosts:</b> sign in to the host dashboard and choose <b>Delete my host account</b>.
          </li>
          <li>
            Need help, or want a copy or deletion of your data another way? Contact us at <Contact />. We reply within 30 days, usually
            much sooner.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Security">
        <p>
          Everything is sent over encrypted HTTPS. The database is locked so it can only be reached through the We Party server, which
          checks who you are before every read or change. No system is perfect, but we work to protect your information.
        </p>
      </InfoSection>

      <InfoSection title="Children">
        <p>
          We Party is not meant for children under 13, and we do not knowingly collect information from them. If you think a child has
          joined a party, contact us and we will delete their information.
        </p>
      </InfoSection>

      <InfoSection title="Changes and contact">
        <p>
          If we change this policy we will update the date at the top of this page, and for big changes we will tell hosts by email.
          Questions? Contact us at <Contact />.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
