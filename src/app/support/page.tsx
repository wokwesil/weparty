import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Help & support",
  description: "Get help with We Party: joining a party, picking songs, hosting, and deleting your data.",
};

export default function SupportPage() {
  return (
    <InfoPage
      title="Help & support"
      intro={
        SUPPORT_EMAIL ? (
          <p>
            Questions, problems or feedback? Email <a className="text-pink hover:underline" href={`mailto:${SUPPORT_EMAIL}?subject=We%20Party%20help`}>{SUPPORT_EMAIL}</a>.
            We usually reply within one business day.
          </p>
        ) : (
          <p>Answers to the most common questions are below.</p>
        )
      }
    >
      <InfoSection title="Joining a party">
        <ul>
          <li>Scan the QR code at the party with your phone camera, or open We Party and tap <b>Scan party QR</b> in the app.</li>
          <li>No QR code? Open We Party, tap <b>Enter party</b> (or <b>Type party code</b> in the app) and type the code the host gives you.</li>
          <li>Enter your name and Instagram username, add a photo if you like, then pick 5 to 10 songs.</li>
          <li>Heart other people&apos;s picks to move them up the queue. Everyone gets a fair turn.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Common problems">
        <ul>
          <li><b>&quot;Party not found&quot;</b>: check the code with the host. Codes are letters and numbers only.</li>
          <li><b>Can&apos;t add songs</b>: the host may have paused requests, or you have reached the song limit for the party.</li>
          <li><b>Queue not updating</b>: check your connection. The screen refreshes itself every few seconds even without live updates.</li>
          <li><b>Camera won&apos;t open in the app</b>: allow camera access in your phone&apos;s Settings → We Party → Camera.</li>
          <li><b>Signed out of a party</b>: open the party link again and join with the same Instagram username.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Hosting a party">
        <ul>
          <li>
            Go to the <Link href="/host">host dashboard</Link>, sign in or create a host account, and create an event to get its QR code
            and printable poster.
          </li>
          <li>Run the queue from the control room on your phone or laptop: play, skip, pin or remove songs, and pause requests.</li>
          <li>Remove a guest from the guest list in the control room if someone is being inappropriate.</li>
          <li>Apple Music playlists (live and replay) are made from the host control room in a web browser.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Reporting a problem with someone">
        <p>
          The host can remove anyone from their party straight away. You can also tap <b>Report</b> next to a person in the
          party&apos;s People tab{SUPPORT_EMAIL ? <> or email <a href={`mailto:${SUPPORT_EMAIL}?subject=Report`}>{SUPPORT_EMAIL}</a></> : null}{" "}
          with the party code and what happened. We review every report and remove content or people that break the rules.
        </p>
      </InfoSection>

      <InfoSection title="Your data">
        <ul>
          <li>
            Guests: open the party, tap your photo, then <b>Leave party and delete my info</b>.
          </li>
          <li>
            Hosts: in the host dashboard, choose <b>Delete my host account</b>.
          </li>
          <li>
            Read the full <Link href="/privacy">privacy policy</Link>.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Install We Party">
        <ul>
          <li><b>iPhone (Safari)</b>: tap the Share button, then <b>Add to Home Screen</b>.</li>
          <li><b>Android (Chrome)</b>: tap <b>Install</b> when asked, or open the ⋮ menu and choose <b>Install app</b>.</li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}
