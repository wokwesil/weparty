import { Artwork } from "@/components/Artwork";
import { Avatar, InstagramLink } from "@/components/Avatar";
import type { GuestRecap } from "@/lib/services/growth";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Your night in music": the signed-in guest's personal recap at the top of the replay. */
export function Recap({ recap, code, showPeople }: { recap: GuestRecap; code: string; showPeople: boolean }) {
  const lines: string[] = [];
  if (recap.songs.length) lines.push(`You picked ${plural(recap.songs.length, "song")}${recap.songsPlayed ? ` and ${recap.songsPlayed} got played` : ""}.`);
  if (recap.heartsReceived) lines.push(`Your picks got ${plural(recap.heartsReceived, "heart")}${recap.rank && recap.rank <= 10 ? `, #${recap.rank} of ${recap.guests} guests` : ""}.`);
  if (recap.heartsGiven) lines.push(`You gave out ${plural(recap.heartsGiven, "heart")}.`);
  if (recap.topArtist) lines.push(`Your artist of the night: ${recap.topArtist}.`);
  if (recap.topGenre) lines.push(`Your vibe: ${recap.topGenre}.`);

  return (
    <section aria-labelledby="recap-title" className="relative mt-8 overflow-hidden rounded-3xl p-5">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pink/30 via-violet/25 to-cyan/15" aria-hidden />
      <p className="text-xs font-bold tracking-[0.3em] text-pink uppercase">Just for you</p>
      <h2 id="recap-title" className="mt-1 font-display text-2xl font-black">Your night in music</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-white/80">You didn&apos;t pick or heart any songs this time. Next party, add a song and heart your favorites!</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5 text-[15px]">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {recap.topSong && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/25 p-2.5">
          <Artwork src={recap.topSong.artworkUrl} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-widest text-muted uppercase">Your most-loved pick</p>
            <p className="truncate font-semibold">{recap.topSong.title}</p>
            <p className="truncate text-sm text-muted">{recap.topSong.artist}</p>
          </div>
          <span className="text-sm text-pink">♥ {recap.topSong.votes}</span>
        </div>
      )}
      {showPeople && recap.matches.length > 0 && <TasteList matches={recap.matches} />}
      <a
        href={`/e/${code}/replay/me`}
        download={`weparty-${code}-my-night.png`}
        className="btn btn-primary mt-4 min-h-12 w-full"
      >
        Save my story image (9:16)
      </a>
    </section>
  );
}

export function TasteList({ matches, title = "People who share your taste" }: { matches: GuestRecap["matches"]; title?: string }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-bold tracking-[0.25em] text-muted uppercase">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {matches.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Avatar person={p} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.displayName}</p>
              <InstagramLink username={p.instagram} className="truncate text-xs" />
            </div>
            <span className="shrink-0 text-xs text-muted">{plural(p.shared, "song")} in common</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
