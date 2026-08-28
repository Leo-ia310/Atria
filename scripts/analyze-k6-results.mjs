import fs from "node:fs";
import readline from "node:readline";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/analyze-k6-results.mjs <k6-jsonl>");
  process.exit(1);
}

const phaseRates = new Map([
  ["rps_3", 3],
  ["rps_4", 4],
  ["rps_5", 5],
  ["rps_6", 6],
  ["rps_8", 8],
  ["rps_10", 10],
  ["rps_12", 12],
  ["rps_15", 15],
  ["rps_20", 20],
  ["rps_30", 30],
  ["rps_40", 40],
]);
const phaseDurationSec = 45;

function makeStats() {
  return {
    durations: [],
    httpReqs: 0,
    httpFailed: 0,
    checks: 0,
    checksFailed: 0,
    statusChecks: 0,
    statusChecksFailed: 0,
    drops: 0,
    mainReqs: 0,
  };
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function add(map, key) {
  if (!map.has(key)) map.set(key, makeStats());
  return map.get(key);
}

const phases = new Map();
const routes = new Map();

const rl = readline.createInterface({
  input: fs.createReadStream(file, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (!line || line[0] !== "{") continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  if (row.type !== "Point") continue;

  const { metric, data } = row;
  const tags = data.tags || {};
  const phase = tags.phase || tags.scenario;
  const route = tags.route;

  if (metric === "dropped_iterations" && phase) {
    add(phases, phase).drops += data.value;
    continue;
  }

  if (!phase || phase === "setup") continue;

  const phaseStats = add(phases, phase);
  const routeStats = route ? add(routes, `${phase}::${route}`) : null;

  if (metric === "http_req_duration") {
    phaseStats.durations.push(data.value);
    phaseStats.httpReqs += 1;
    if (routeStats) {
      routeStats.durations.push(data.value);
      routeStats.httpReqs += 1;
    }
    if (route && !route.endsWith("_asset")) {
      phaseStats.mainReqs += 1;
      if (routeStats) routeStats.mainReqs += 1;
    }
  }

  if (metric === "http_req_failed") {
    if (data.value === 1) {
      phaseStats.httpFailed += 1;
      if (routeStats) routeStats.httpFailed += 1;
    }
  }

  if (metric === "checks") {
    phaseStats.checks += 1;
    if (data.value !== 1) phaseStats.checksFailed += 1;
    if (tags.check === "status esperado") {
      phaseStats.statusChecks += 1;
      if (data.value !== 1) phaseStats.statusChecksFailed += 1;
    }
    if (routeStats) {
      routeStats.checks += 1;
      if (data.value !== 1) routeStats.checksFailed += 1;
      if (tags.check === "status esperado") {
        routeStats.statusChecks += 1;
        if (data.value !== 1) routeStats.statusChecksFailed += 1;
      }
    }
  }
}

function phaseRow(name, stats) {
  const rate = phaseRates.get(name) || Number(name.replace("rps_", ""));
  const scheduled = rate * phaseDurationSec;
  const interrupted = Math.max(0, scheduled - stats.mainReqs - stats.drops);
  const okChecks = stats.checks ? (stats.checks - stats.checksFailed) / stats.checks : 0;
  const httpFailRate = stats.httpReqs ? stats.httpFailed / stats.httpReqs : 0;

  return {
    phase: name,
    target_iter_s: rate,
    scheduled_iterations: scheduled,
    completed_main_requests: stats.mainReqs,
    dropped_iterations: stats.drops,
    inferred_interrupted_iterations: interrupted,
    http_requests: stats.httpReqs,
    http_req_s_completed: round(stats.httpReqs / phaseDurationSec),
    http_fail_rate_pct: round(httpFailRate * 100),
    checks_ok_pct: round(okChecks * 100),
    p50_ms: round(percentile(stats.durations, 50)),
    p95_ms: round(percentile(stats.durations, 95)),
    p99_ms: round(percentile(stats.durations, 99)),
    max_ms: round(Math.max(0, ...stats.durations)),
  };
}

const phaseRows = [...phases.entries()]
  .filter(([name]) => name.startsWith("rps_"))
  .map(([name, stats]) => phaseRow(name, stats))
  .sort((a, b) => a.target_iter_s - b.target_iter_s);

const routeRows = [...routes.entries()]
  .map(([key, stats]) => {
    const [phase, route] = key.split("::");
    return {
      phase,
      route,
      http_requests: stats.httpReqs,
      http_fail_rate_pct: round((stats.httpFailed / Math.max(1, stats.httpReqs)) * 100),
      checks_ok_pct: round(
        ((stats.checks - stats.checksFailed) / Math.max(1, stats.checks)) * 100,
      ),
      p95_ms: round(percentile(stats.durations, 95)),
      p99_ms: round(percentile(stats.durations, 99)),
      max_ms: round(Math.max(0, ...stats.durations)),
    };
  })
  .filter((row) => !row.route.endsWith("_asset"))
  .sort((a, b) => {
    const pa = phaseRates.get(a.phase) || 0;
    const pb = phaseRates.get(b.phase) || 0;
    if (pa !== pb) return pa - pb;
    return b.p95_ms - a.p95_ms;
  });

console.log(JSON.stringify({ phases: phaseRows, routes: routeRows }, null, 2));
