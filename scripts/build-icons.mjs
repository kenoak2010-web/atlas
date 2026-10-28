// Renders the ATLAS app icon (SVG) into the PNG sizes needed for PWA / iOS.
// Run: node scripts/build-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

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
console.log("icons written");
