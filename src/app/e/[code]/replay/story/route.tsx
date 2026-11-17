import { ImageResponse } from "next/og";
import { getEventByCode } from "@/lib/services/events";
import { getReplay } from "@/lib/services/queue";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Shareable image of the replay.
 *   default      1080x1920 Instagram Story image
 *   ?format=og   1200x630 link preview image
 */
export async function GET(req: Request, ctx: Ctx) {
  const event = await getEventByCode((await ctx.params).code);
  const replay = event ? await getReplay(event.id) : null;
  if (!event || !replay) return new Response("Not found", { status: 404 });
  const og = new URL(req.url).searchParams.get("format") === "og";
  const W = og ? 1200 : 1080;
  const H = og ? 630 : 1920;
  const songs = replay.played.slice(0, og ? 0 : 8);
  const covers = replay.played.filter((s) => s.artworkUrl).slice(0, 4);
  const date = (event.starts_at ?? event.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const cover = og ? 360 : 640;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: og ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: og ? 60 : 40,
          padding: og ? 60 : 80,
          background: "linear-gradient(160deg, #1a0b2e 0%, #07060c 45%, #0b1b2b 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", width: cover, height: cover, borderRadius: 40, overflow: "hidden", background: "linear-gradient(120deg,#ff2e88,#8b5cf6,#22d3ee)" }}>
          {covers.length === 4 &&
            covers.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={s.artworkUrl!} width={cover / 2} height={cover / 2} alt="" style={{ objectFit: "cover" }} />
            ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: og ? "flex-start" : "center", maxWidth: og ? 680 : 920 }}>
          <div style={{ fontSize: og ? 28 : 34, letterSpacing: 10, color: "#ff2e88", fontWeight: 800 }}>MY WEPARTY REPLAY</div>
          <div
            style={{
              display: "flex",
              justifyContent: og ? "flex-start" : "center",
              width: og ? 680 : 920,
              fontSize: event.name.length > 40 ? (og ? 44 : 60) : event.name.length > 16 ? (og ? 54 : 72) : og ? 64 : 84,
              fontWeight: 900,
              marginTop: 16,
              textAlign: og ? "left" : "center",
              lineHeight: 1.1,
            }}
          >
            {event.name}
          </div>
          <div style={{ fontSize: og ? 28 : 36, color: "#a39fbd", marginTop: 16 }}>
            {`${date} · ${replay.stats.played} songs · ${replay.stats.guests} guests · ${replay.stats.votes} hearts`}
          </div>
          {songs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 50, gap: 14, width: "100%" }}>
              {songs.map((s, i) => (
                <div key={s.id} style={{ display: "flex", fontSize: 36, gap: 20 }}>
                  <span style={{ color: "#8b5cf6", width: 50 }}>{String(i + 1)}</span>
                  <span style={{ fontWeight: 700, maxWidth: 520, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.title}</span>
                  <span style={{ color: "#a39fbd", maxWidth: 300, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.artist}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: og ? "flex-start" : "center", marginTop: og ? 40 : 70 }}>
            <div
              style={{
                fontSize: og ? 52 : 72,
                fontWeight: 900,
                backgroundImage: "linear-gradient(90deg,#ff2e88,#8b5cf6,#22d3ee)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              WEPARTY
            </div>
            <div style={{ fontSize: og ? 24 : 30, marginTop: 6 }}>Where We All Control the Vibes · Powered by Offtrack</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
