// Browser smoke test: opens every screen in an iPhone viewport, records page errors,
// console errors and CSP violations, checks the tab bar, and saves screenshots.
// Usage: npm run build && npm start, then: node scripts/e2e-smoke.cjs [paths...]
// Requires Playwright (preinstalled globally in CI images, or `npm i -D playwright`).
const { chromium, devices } = require("playwright");
const fs = require("node:fs");

const BASE = process.env.ATLAS_URL || "http://localhost:3000";
const OUT = process.env.SHOTS_DIR || "test-results/screens";
const ALL = ["/", "/map", "/news", "/tv", "/explore", "/explore/hazards", "/explore/weather", "/explore/aviation", "/explore/space", "/explore/economy", "/explore/humanitarian", "/timeline", "/search", "/alerts", "/settings", "/sources", "/saved", "/offline"];
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const scheme = process.env.SCHEME || "light";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 14 Pro Max"], colorScheme: scheme });
  const page = await ctx.newPage();
  let failures = 0;
  for (const p of paths) {
    const errors = [];
    const onErr = (e) => errors.push(`pageerror: ${e.message}`);
    const onCon = (m) => {
      const txt = m.text();
      // Upstream providers or tiles can be unreachable; those surface in the UI, not as app errors.
      if (/Failed to load resource/.test(txt)) return;
      if (m.type() === "error" || /Content Security Policy/.test(txt)) errors.push(`console: ${txt.slice(0, 240)}`);
    };
    page.on("pageerror", onErr);
    page.on("console", onCon);
    const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(Number(process.env.WAIT || 6000));
    const tabs = await page.locator('nav[aria-label="Hauptnavigation"] a').count();
    const name = p === "/" ? "home" : p.slice(1).replace(/\//g, "_");
    await page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage: process.env.FULL === "1" });
    const ok = res && res.status() < 400 && tabs === 5 && errors.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${p} status=${res && res.status()} tabs=${tabs} ${errors.length ? JSON.stringify(errors.slice(0, 5)) : ""}`);
    page.off("pageerror", onErr);
    page.off("console", onCon);
  }
  await browser.close();
  process.exitCode = failures ? 1 : 0;
})();
