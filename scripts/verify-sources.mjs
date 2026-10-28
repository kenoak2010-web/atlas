// Calls every ATLAS provider through the running app (/api/data/*) and reports
// status, item count, freshness and errors. Usage: npm run dev, then npm run verify:sources
const BASE = process.env.ATLAS_URL ?? "http://localhost:3000";
const CHECKS = [
  ["news", ""],
  ["gdelt", "q=earthquake"],
  ["earthquakes", "minMag=4.5&range=day"],
  ["earthquakes", "minMag=all&range=hour"],
  ["weather", "lat=52.52&lon=13.41"],
  ["world-weather", ""],
  ["alerts-de", ""],
  ["alerts-us", ""],
  ["gdacs", ""],
  ["eonet", ""],
  ["firms", ""],
  ["volcanoes", ""],
  ["volcanoes-us", ""],
  ["humanitarian", ""],
  ["aircraft", "bbox=46,4,56,16"],
  ["iss", ""],
  ["space-weather", ""],
  ["launches", ""],
  ["markets", ""],
  ["crypto", ""],
  ["crypto-chart", "id=bitcoin"],
  ["fx", ""],
  ["geocode", "q=Berlin"],
];
const count = (d) => (d == null ? 0 : Array.isArray(d) ? d.length : d.clusters ? d.clusters.length : d.quotes ? d.quotes.length : d.kp ? d.kp.length + d.alerts.length : 1);
let failed = 0;
for (const [id, qs] of CHECKS) {
  const t = Date.now();
  try {
    const r = await fetch(`${BASE}/api/data/${id}${qs ? `?${qs}` : ""}`);
    const j = await r.json();
    const ok = j.data != null;
    if (!ok) failed++;
    console.log(`${ok ? "OK  " : "FAIL"} ${id.padEnd(14)} ${String(count(j.data)).padStart(5)} items  ${String(j.freshness).padEnd(11)} src:${j.sourceUpdatedAt ?? "-"}  ${Date.now() - t}ms ${j.error ? "ERR: " + j.error : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${id} ${e.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
