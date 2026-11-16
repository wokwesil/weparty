/* eslint-disable @next/next/no-img-element */
export function Artwork({ src, size = 56, className = "", alt = "" }: { src: string | null; size?: number; className?: string; alt?: string }) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span style={style} className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet/60 to-pink/50 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 fill-white/80" aria-hidden>
          <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="white" strokeWidth="1.5" fill="none" />
        </svg>
      </span>
    );
  }
  const sized = src.replace(/\/\d+x\d+bb\./, `/${Math.min(600, size * 2)}x${Math.min(600, size * 2)}bb.`);
  return <img src={sized} alt={alt} style={style} className={`shrink-0 rounded-xl object-cover ${className}`} loading="lazy" />;
}
