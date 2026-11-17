import { ImageResponse } from "next/og";
import { flags } from "@/lib/flags";
import { getEventByCode } from "@/lib/services/events";
import { getGuestRecap } from "@/lib/services/growth";
import { currentGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

/** "Your night in music" as a 1080x1920 (9:16) Instagram Story image, for the guest viewing it. */
export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const event = await getEventByCode(code);
  if (!event || !flags.growth) return new Response("Not found", { status: 404 });
  const guest = await currentGuest(event);
  // Not this party's guest on this phone: fall back to the party's own story image.
  if (!guest) return Response.redirect(new URL(`/e/${event.code}/replay/story`, req.url), 302);
  const r = await getGuestRecap(event, guest);
  const date = (event.starts_at ?? event.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const stats: [string, string][] = [
    [String(r.songs.length), r.songs.length === 1 ? "song picked" : "songs picked"],
    [String(r.songsPlayed), "played"],
    [String(r.heartsReceived), "hearts received"],
    [String(r.heartsGiven), "hearts given"],
  ];
  const songs = r.songs.slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1920,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "120px 80px",
          background: "linear-gradient(165deg, #3a0d2e 0%, #160a2a 35%, #07060c 70%, #0b1b2b 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 12, color: "#ff2e88", fontWeight: 800 }}>MY NIGHT IN MUSIC</div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: 920,
            fontSize: event.name.length > 40 ? 60 : event.name.length > 16 ? 76 : 92,
            fontWeight: 900,
            marginTop: 28,
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {event.name}
        </div>
        <div style={{ fontSize: 36, color: "#c9c5e0", marginTop: 18 }}>{`${date} · @${r.instagram}`}</div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, marginTop: 70, width: "100%" }}>
          {stats.map(([v, l]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 430, padding: "30px 0", borderRadius: 36, background: "rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 96, fontWeight: 900 }}>{v}</div>
              <div style={{ fontSize: 32, color: "#c9c5e0" }}>{l}</div>
            </div>
          ))}
        </div>

        {(r.topArtist || r.topGenre) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 60 }}>
            {r.topArtist && <div style={{ fontSize: 36, color: "#c9c5e0" }}>Artist of the night</div>}
            {r.topArtist && <div style={{ fontSize: 60, fontWeight: 900, marginTop: 6, textAlign: "center" }}>{r.topArtist}</div>}
            {r.topGenre && <div style={{ fontSize: 36, color: "#22d3ee", marginTop: 14 }}>{`Vibe: ${r.topGenre}`}</div>}
          </div>
        )}

        {songs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 60, width: "100%" }}>
            <div style={{ fontSize: 30, letterSpacing: 8, color: "#c9c5e0" }}>MY PICKS</div>
            {songs.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 38 }}>
                {s.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.artworkUrl} width={90} height={90} alt="" style={{ borderRadius: 18, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 90, height: 90, borderRadius: 18, background: "linear-gradient(120deg,#ff2e88,#8b5cf6)" }} />
                )}
                <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  <span style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 700 }}>{s.title}</span>
                  <span style={{ fontSize: 30, color: "#c9c5e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 700 }}>{s.artist}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ff2e88", fontSize: 34 }}>
                  <svg width="34" height="34" viewBox="0 0 24 24">
                    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3.1 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.8 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21Z" fill="#ff2e88" />
                  </svg>
                  {String(s.votes)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto" }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              backgroundImage: "linear-gradient(90deg,#ff2e88,#8b5cf6,#22d3ee)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            WE PARTY
          </div>
          <div style={{ fontSize: 30, marginTop: 6 }}>Where We All Control the Vibes · Powered by Offtrack</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store" } },
  );
}
