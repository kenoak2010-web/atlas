// Renders the ATLAS app icon (SVG) into the PNG sizes needed for the PWA and the iOS app.
// Run: node scripts/build-icons.mjs
import sharp from "sharp";
import { existsSync, writeFileSync } from "node:fs";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1c1e"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${1 - pad})" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round">
    <circle r="150"/>
    <ellipse rx="62" ry="150"/>
    <path d="M-150 0H150M-130 -75H130M-130 75H130"/>
  </g>
  <circle cx="${256 + 106 * (1 - pad)}" cy="${256 - 106 * (1 - pad)}" r="${30 * (1 - pad)}" fill="#0a84ff" stroke="#000" stroke-width="10"/>
</svg>`;

writeFileSync("public/icons/icon.svg", svg(0.1));
const jobs = [
  ["icon-192.png", 192, 0.1],
  ["icon-512.png", 512, 0.1],
  ["maskable-512.png", 512, 0.3],
  ["apple-touch-icon.png", 180, 0.12],
];
for (const [name, size, pad] of jobs) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
await sharp(Buffer.from(svg(0.1))).resize(32, 32).png().toFile("public/favicon.png");

// iOS app (Capacitor): the App Store icon must be 1024px and fully opaque.
const IOS = "ios/App/App/Assets.xcassets";
if (existsSync(IOS)) {
  await sharp(Buffer.from(svg(0.1))).resize(1024, 1024).flatten({ background: "#000" }).removeAlpha().png().toFile(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`);
  // Splash: small logo centred on the app background colour.
  const logo = await sharp(Buffer.from(svg(0.1))).resize(560, 560).png().toBuffer();
  const splash = sharp({ create: { width: 2732, height: 2732, channels: 3, background: "#04060c" } }).composite([{ input: logo, gravity: "center" }]).png();
  const buf = await splash.toBuffer();
  for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) writeFileSync(`${IOS}/Splash.imageset/${f}`, buf);
}
console.log("icons written");
