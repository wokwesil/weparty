/**
 * Faded silhouettes of people dancing, drawn behind the home-page hero.
 * Pure SVG (no images to load), decorative only, and kept faint so the
 * title and tagline stay easy to read. Motion stops for people who ask
 * their phone for reduced motion (see globals.css).
 */

type Pose = {
  arms: string; // path for both arms, from the shoulders
  legs: string; // path for both legs, from the hips
  lean?: number; // body tilt in degrees
};

// Each figure is drawn in a 100 x 220 box: head at (50, 28), shoulders at y=58, hips at y=120.
const POSES: Pose[] = [
  { arms: "M50 62 L22 22 M50 62 L80 20", legs: "M50 120 L34 200 M50 120 L68 198" }, // both hands up
  { arms: "M50 62 L18 48 M50 62 L84 18", legs: "M50 120 L30 196 M50 120 L62 200" }, // one hand up
  { arms: "M50 62 L28 92 L40 60 M50 62 L76 30 L88 8", legs: "M50 120 L40 200 M50 120 L76 190", lean: -6 },
  { arms: "M50 62 L14 30 M50 62 L72 96", legs: "M50 120 L36 200 M50 120 L58 200", lean: 5 },
  { arms: "M50 62 L30 28 L44 8 M50 62 L70 28 L56 8", legs: "M50 120 L26 194 M50 120 L74 194" }, // hands together overhead
  { arms: "M50 62 L86 44 M50 62 L20 84", legs: "M50 120 L44 200 M50 120 L82 184", lean: 8 },
];

// x position (% of width), scale, pose, colour, animation delay (s)
const CROWD: [number, number, number, string, number][] = [
  [2, 0.8, 0, "var(--color-pink)", 0],
  [11, 1.05, 3, "var(--color-violet)", -0.4],
  [20, 0.85, 1, "var(--color-cyan)", -0.8],
  [29, 1.15, 4, "var(--color-pink)", -0.2],
  [38, 0.9, 2, "var(--color-violet)", -0.6],
  [47, 1.2, 0, "var(--color-cyan)", -1],
  [56, 0.95, 5, "var(--color-pink)", -0.3],
  [65, 1.1, 1, "var(--color-violet)", -0.7],
  [74, 0.85, 3, "var(--color-cyan)", -0.5],
  [83, 1.05, 2, "var(--color-pink)", -0.9],
  [92, 0.8, 4, "var(--color-violet)", -0.1],
];

function Dancer({ pose, color }: { pose: Pose; color: string }) {
  return (
    <svg viewBox="0 0 100 220" className="h-full w-full overflow-visible">
      <g
        transform={`rotate(${pose.lean ?? 0} 50 120)`}
        stroke={color}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="28" r="15" fill={color} stroke="none" />
        <path d="M50 50 L50 120" strokeWidth="24" />
        <path d={pose.arms} strokeWidth="11" />
        <path d={pose.legs} strokeWidth="14" />
      </g>
    </svg>
  );
}

export function DancingCrowd({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`}
      aria-hidden
      style={{
        maskImage: "linear-gradient(to top, transparent 0%, black 35%, black 70%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 35%, black 70%, transparent 100%)",
      }}
    >
      {CROWD.map(([x, scale, pose, color, delay], i) => (
        <div
          key={i}
          className="absolute bottom-0 origin-bottom animate-dance"
          style={{
            left: `${x}%`,
            width: `${8 * scale}%`,
            height: `${78 * scale}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${1 + (i % 3) * 0.15}s`,
            filter: "blur(1.5px)",
          }}
        >
          <Dancer pose={POSES[pose]} color={color} />
        </div>
      ))}
    </div>
  );
}
