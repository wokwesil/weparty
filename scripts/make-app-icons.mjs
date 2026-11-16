// Draws every WeParty icon and splash image from one piece of artwork:
// the WEPARTY equalizer-bars mark on the dark "night" background.
//
//   node scripts/make-app-icons.mjs
//
// Writes:
//   public/icons/*            website + installable app (PWA) icons
//   public/favicon.ico        browser tab icon
//   assets/*.png              source images for the iPhone/Android apps
//                             (then run `npm run app:assets` to make every native size)
//
// Uses the Chromium that Playwright already installs for our browser tests.
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => path.join(root, ...p);

const NIGHT = "#07060c";
const PINK = "#ff2e88";
const VIOLET = "#8b5cf6";
const CYAN = "#22d3ee";

/** The bars mark, drawn in a 64x64 box (same shape as public/icon.svg). */
function bars() {
  const heights = [22, 32, 26, 36];
  return heights
    .map((h, i) => `<rect x="${14 + i * 10}" y="${50 - h}" width="6" height="${h}" rx="3"/>`)
    .join("");
}

/**
 * One square icon.
 * - scale: how much of the square the 64x64 mark fills (1 = full, maskable icons need ~0.62)
 * - rounded: rounded corners with see-through edges (only for website icons; stores round icons themselves)
 * - background: false gives a see-through background (Android adaptive icon foreground)
 */
function iconSvg({ size, scale = 1, rounded = false, background = true }) {
  const inset = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PINK}"/><stop offset=".55" stop-color="${VIOLET}"/><stop offset="1" stop-color="${CYAN}"/>
    </linearGradient>
    <radialGradient id="glowPink" cx=".15" cy=".1" r=".75"><stop offset="0" stop-color="${PINK}" stop-opacity=".32"/><stop offset="1" stop-color="${PINK}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowCyan" cx=".9" cy=".95" r=".7"><stop offset="0" stop-color="${CYAN}" stop-opacity=".22"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
  </defs>
  ${
    background
      ? `<rect width="64" height="64" ${rounded ? 'rx="14"' : ""} fill="${NIGHT}"/>
  <rect width="64" height="64" ${rounded ? 'rx="14"' : ""} fill="url(#glowPink)"/>
  <rect width="64" height="64" ${rounded ? 'rx="14"' : ""} fill="url(#glowCyan)"/>`
      : ""
  }
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <g fill="url(#g)" opacity=".55" filter="url(#soft)">${bars()}</g>
    <g fill="url(#g)">${bars()}</g>
  </g>
</svg>`;
}

/** Background-only square (Android adaptive icon background layer). */
function backgroundSvg(size) {
  return iconSvg({ size, scale: 0.0001 }).replace(/<g transform[\s\S]*?<\/g>\s*<\/g>/, "");
}

async function fontFace() {
  const font = await readFile(out("node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2"));
  return `@font-face{font-family:"Unbounded";font-weight:200 900;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");}`;
}

/** Launch screen: mark + WEPARTY wordmark + tagline, centered so any phone/tablet crop keeps it. */
function splashHtml(size, css) {
  const mark = iconSvg({ size: 360, background: false }).replace(/width="360" height="360"/, 'width="360" height="360"');
  return `<!doctype html><html><head><style>${css}
  html,body{margin:0;width:${size}px;height:${size}px;background:${NIGHT};overflow:hidden}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;
    background:radial-gradient(circle at 20% 15%, ${PINK}33, transparent 45%), radial-gradient(circle at 85% 90%, ${CYAN}26, transparent 45%), ${NIGHT}}
  .word{font-family:Unbounded;font-weight:900;font-size:150px;letter-spacing:-4px;
    background:linear-gradient(90deg, ${PINK}, ${VIOLET}, ${CYAN});-webkit-background-clip:text;background-clip:text;color:transparent}
  .tag{font-family:Unbounded;font-weight:500;font-size:44px;color:#f5f3ff;opacity:.85}
  </style></head><body><div class="wrap">${mark}<div class="word">WEPARTY</div><div class="tag">Where We All Control the Vibes.</div></div></body></html>`;
}

/** A .ico file that simply wraps PNG images (supported by every modern browser). */
function pngsToIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(html, size, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    html.startsWith("<svg")
      ? `<!doctype html><html><body style="margin:0;background:transparent">${html.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`
      : html,
  );
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

await mkdir(out("public/icons"), { recursive: true });
await mkdir(out("assets"), { recursive: true });

const files = {
  // Website / installable app
  "public/icons/icon-192.png": [iconSvg({ size: 192, rounded: true }), 192, true],
  "public/icons/icon-512.png": [iconSvg({ size: 512, rounded: true }), 512, true],
  "public/icons/maskable-512.png": [iconSvg({ size: 512, scale: 0.62 }), 512],
  "public/icons/maskable-192.png": [iconSvg({ size: 192, scale: 0.62 }), 192],
  "public/icons/apple-touch-icon.png": [iconSvg({ size: 180, scale: 0.86 }), 180],
  "public/apple-touch-icon.png": [iconSvg({ size: 180, scale: 0.86 }), 180],
  // Native app sources for @capacitor/assets
  "assets/icon-only.png": [iconSvg({ size: 1024, scale: 0.86 }), 1024],
  "assets/icon-foreground.png": [iconSvg({ size: 1024, scale: 0.6, background: false }), 1024, true],
  "assets/icon-background.png": [backgroundSvg(1024), 1024],
};

for (const [file, [svg, size, transparent]] of Object.entries(files)) {
  await writeFile(out(file), await render(svg, size, transparent));
  console.log("wrote", file);
}

const css = await fontFace();
const splash = await render(splashHtml(2732, css), 2732);
await writeFile(out("assets/splash.png"), splash);
await writeFile(out("assets/splash-dark.png"), splash);
console.log("wrote assets/splash.png, assets/splash-dark.png");

const icoImages = [];
for (const size of [16, 32, 48]) icoImages.push({ size, png: await render(iconSvg({ size, rounded: true }), size, true) });
await writeFile(out("public/favicon.ico"), pngsToIco(icoImages));
console.log("wrote public/favicon.ico");

await browser.close();
