/**
 * Faded party scene behind the home-page hero: a crowd of people with their
 * hands up, backlit by stage lights, with confetti. Pure SVG drawn in code
 * (no photo to license or download), decorative only, and kept faint so the
 * title and tagline stay easy to read. The gentle sway stops for people who
 * ask their phone for reduced motion (see globals.css).
 */

const W = 1200;
const H = 420;

// Small deterministic random so the server and browser draw the same crowd.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

type Person = { x: number; s: number; arms: [number, number][]; tilt: number; delay: number };

function makeRow(count: number, scale: number, seed: number): Person[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = ((i + 0.5) / count) * (W + 120) - 60 + (r() - 0.5) * 50;
    const s = scale * (0.85 + r() * 0.3);
    // Each arm: [side (-1 left, 1 right), how high: 0 = down, 1 = straight up]
    const pick = r();
    const arms: [number, number][] =
      pick < 0.45 ? [[-1, 0.7 + r() * 0.3], [1, 0.7 + r() * 0.3]] : pick < 0.85 ? [[r() < 0.5 ? -1 : 1, 0.75 + r() * 0.25]] : [];
    return { x, s, arms, tilt: (r() - 0.5) * 10, delay: -r() * 1.2 };
  });
}

const BACK = makeRow(14, 0.72, 7);
const FRONT = makeRow(10, 1, 42);

function Silhouette({ p, fill }: { p: Person; fill: string }) {
  const { x, s } = p;
  const base = H + 10;
  const shoulderY = base - 118 * s;
  return (
    <g
      className="animate-dance"
      style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animationDelay: `${p.delay}s` }}
    >
      <g transform={`rotate(${p.tilt} ${x} ${base})`} fill={fill} stroke={fill} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx={x} cy={base - 152 * s} rx={19 * s} ry={23 * s} stroke="none" />
        <path
          stroke="none"
          d={`M${x - 52 * s} ${base} L${x - 48 * s} ${shoulderY + 12 * s} Q${x - 44 * s} ${shoulderY - 6 * s} ${x - 20 * s} ${shoulderY - 10 * s}
              L${x + 20 * s} ${shoulderY - 10 * s} Q${x + 44 * s} ${shoulderY - 6 * s} ${x + 48 * s} ${shoulderY + 12 * s} L${x + 52 * s} ${base} Z`}
        />
        {p.arms.map(([side, up], i) => {
          const sx = x + side * 40 * s;
          const sy = shoulderY;
          const ex = sx + side * (34 - 14 * up) * s;
          const ey = sy - 70 * up * s;
          const hx = ex + side * (18 - 30 * up) * s;
          const hy = ey - 72 * up * s;
          return (
            <g key={i}>
              <path d={`M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}`} fill="none" strokeWidth={17 * s} />
              <circle cx={hx} cy={hy - 6 * s} r={11 * s} stroke="none" />
            </g>
          );
        })}
      </g>
    </g>
  );
}

const LIGHTS = [
  { x: 140, c: "#ff2e88", r: 260 },
  { x: 430, c: "#8b5cf6", r: 220 },
  { x: 760, c: "#ff3b3b", r: 240 },
  { x: 1060, c: "#22d3ee", r: 230 },
];

const CONFETTI = (() => {
  const r = rng(99);
  const colors = ["#ff2e88", "#22d3ee", "#b6f35c", "#ffffff", "#8b5cf6", "#ffd166"];
  return Array.from({ length: 70 }, () => ({
    x: r() * W,
    y: r() * H * 0.75,
    w: 3 + r() * 6,
    h: 2 + r() * 3,
    rot: r() * 180,
    c: colors[Math.floor(r() * colors.length)],
  }));
})();

// Soft edges on every side so the scene melts into the page.
const FADE_Y = "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)";
const FADE_X = "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)";

export function DancingCrowd({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute overflow-hidden ${className}`}
      aria-hidden
      style={{ maskImage: FADE_X, WebkitMaskImage: FADE_X }}
    >
      <div className="h-full w-full" style={{ maskImage: FADE_Y, WebkitMaskImage: FADE_Y }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          {LIGHTS.map((l, i) => (
            <radialGradient key={i} id={`wp-light-${i}`}>
              <stop offset="0%" stopColor={l.c} stopOpacity="0.95" />
              <stop offset="35%" stopColor={l.c} stopOpacity="0.35" />
              <stop offset="100%" stopColor={l.c} stopOpacity="0" />
            </radialGradient>
          ))}
          <linearGradient id="wp-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Stage lights and beams */}
        {LIGHTS.map((l, i) => (
          <circle key={i} cx={l.x} cy={70} r={l.r} fill={`url(#wp-light-${i})`} />
        ))}
        {LIGHTS.map((l, i) => (
          <polygon key={`b${i}`} points={`${l.x - 6},60 ${l.x + 6},60 ${l.x + 150 - i * 90},${H} ${l.x - 30 - i * 40},${H}`} fill="url(#wp-beam)" opacity="0.5" />
        ))}

        {/* Confetti */}
        {CONFETTI.map((c, i) => (
          <rect key={`c${i}`} x={c.x} y={c.y} width={c.w} height={c.h} fill={c.c} opacity="0.85" transform={`rotate(${c.rot} ${c.x} ${c.y})`} />
        ))}

        {/* Crowd: a hazier back row, then a darker front row */}
        {BACK.map((p, i) => (
          <Silhouette key={`k${i}`} p={p} fill="#1c0f22" />
        ))}
        {FRONT.map((p, i) => (
          <Silhouette key={`f${i}`} p={p} fill="#050308" />
        ))}
      </svg>
      </div>
    </div>
  );
}
