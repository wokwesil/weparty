/**
 * Faded party photo behind the home-page hero: a club crowd with hands up
 * under red stage lights.
 *
 * Photo: "People partying inside room" by Pim Myten on Unsplash
 * https://unsplash.com/photos/people-partying-inside-room-m41k1lTzjVM
 * Free to use under the Unsplash License (commercial use OK, no credit
 * required). Served from Unsplash's own image CDN, which resizes it for each
 * screen, as Unsplash recommends. To swap the photo, change PHOTO below.
 */

const PHOTO = "https://images.unsplash.com/photo-1545128485-c400e7702796";
const src = (w: number) => `${PHOTO}?auto=format&fit=crop&q=60&w=${w}`;

// Soft edges on every side so the photo melts into the page.
const FADE_Y = "linear-gradient(to bottom, transparent 0%, black 22%, black 72%, transparent 100%)";
const FADE_X = "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)";

export function PartyPhoto({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute overflow-hidden ${className}`}
      aria-hidden
      style={{ maskImage: FADE_X, WebkitMaskImage: FADE_X }}
    >
      <div className="h-full w-full" style={{ maskImage: FADE_Y, WebkitMaskImage: FADE_Y }}>
        {/* Fallback glow in case the photo can't load (e.g. weak venue Wi-Fi). */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,46,136,0.35),transparent_65%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src(1200)}
          srcSet={`${src(800)} 800w, ${src(1200)} 1200w, ${src(1800)} 1800w`}
          sizes="(min-width: 768px) 1100px, 100vw"
          alt=""
          fetchPriority="low"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Darken slightly so the title and tagline stay easy to read. */}
        <div className="absolute inset-0 bg-night/35" />
      </div>
    </div>
  );
}
