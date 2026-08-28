import exec from "k6/execution";
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const PROFILE = __ENV.K6_PROFILE || "capacity";
const COLD_ASSET_RATE = Number(__ENV.COLD_ASSET_RATE || "0.08");

const profiles = {
  smoke: [
    { name: "smoke_5", rate: 5, duration: "20s" },
  ],
  baseline: [
    { name: "rps_3", rate: 3, duration: "40s" },
    { name: "rps_5", rate: 5, duration: "40s" },
    { name: "rps_8", rate: 8, duration: "40s" },
  ],
  fine: [
    { name: "rps_3", rate: 3, duration: "45s" },
    { name: "rps_4", rate: 4, duration: "45s" },
    { name: "rps_5", rate: 5, duration: "45s" },
    { name: "rps_6", rate: 6, duration: "45s" },
  ],
  capacity: [
    { name: "rps_3", rate: 3, duration: "45s" },
    { name: "rps_5", rate: 5, duration: "45s" },
    { name: "rps_8", rate: 8, duration: "45s" },
    { name: "rps_10", rate: 10, duration: "45s" },
    { name: "rps_12", rate: 12, duration: "45s" },
    { name: "rps_15", rate: 15, duration: "45s" },
    { name: "rps_20", rate: 20, duration: "45s" },
    { name: "rps_30", rate: 30, duration: "45s" },
    { name: "rps_40", rate: 40, duration: "45s" },
  ],
  breaker: [
    { name: "rps_50", rate: 50, duration: "30s" },
    { name: "rps_75", rate: 75, duration: "30s" },
    { name: "rps_100", rate: 100, duration: "30s" },
  ],
};

function durationToSeconds(value) {
  const match = /^(\d+)(s|m)$/.exec(value);
  if (!match) {
    throw new Error(`Duracion invalida: ${value}`);
  }
  const amount = Number(match[1]);
  return match[2] === "m" ? amount * 60 : amount;
}

function buildScenarios(steps) {
  let start = 0;
  const scenarios = {};

  for (const step of steps) {
    scenarios[step.name] = {
      executor: "constant-arrival-rate",
      exec: "browse",
      rate: step.rate,
      timeUnit: "1s",
      duration: step.duration,
      startTime: `${start}s`,
      gracefulStop: "10s",
      preAllocatedVUs: Math.min(Math.max(Math.ceil(step.rate / 2), 20), 250),
      maxVUs: Math.min(Math.max(step.rate * 3, 80), 1200),
      tags: {
        profile: PROFILE,
        phase: step.name,
        target_rps: String(step.rate),
      },
    };
    start += durationToSeconds(step.duration) + 10;
  }

  return scenarios;
}

export const options = {
  scenarios: buildScenarios(profiles[PROFILE] || profiles.capacity),
  noConnectionReuse: false,
  discardResponseBodies: false,
  userAgent: "ARCA-k6-stress/1.0",
  summaryTrendStats: ["min", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const routes = [
  { name: "landing", path: "/", weight: 20, ok: [200], coldAssets: true },
  { name: "pricing", path: "/precios", weight: 10, ok: [200], coldAssets: true },
  { name: "login_page", path: "/login", weight: 8, ok: [200], coldAssets: true },
  { name: "register_page", path: "/registro", weight: 6, ok: [200], coldAssets: true },
  { name: "legal_privacy", path: "/legal/privacidad", weight: 4, ok: [200] },
  { name: "menu_tiptop", path: "/tiptop", weight: 13, ok: [200], coldAssets: true },
  {
    name: "menu_nicaris_carta",
    path: "/nicaris-carta-principal?mesa=1",
    weight: 13,
    ok: [200],
    coldAssets: true,
  },
  {
    name: "menu_nicaris_desayunos",
    path: "/nicaris-desayunos-cafe?mesa=2",
    weight: 8,
    ok: [200],
    coldAssets: true,
  },
  {
    name: "menu_nicaris_bebidas",
    path: "/nicaris-bebidas-postres?mesa=3",
    weight: 8,
    ok: [200],
    coldAssets: true,
  },
  { name: "auth_csrf", path: "/api/auth/csrf", weight: 5, ok: [200] },
  { name: "protected_redirect", path: "/dashboard", weight: 5, ok: [307], redirects: 0 },
];

const totalWeight = routes.reduce((sum, route) => sum + route.weight, 0);

function pickRoute() {
  let cursor = Math.random() * totalWeight;
  for (const route of routes) {
    cursor -= route.weight;
    if (cursor <= 0) return route;
  }
  return routes[routes.length - 1];
}

function absoluteUrl(path) {
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function assetUrlsFromHtml(body) {
  if (!body) return [];
  const urls = new Set();
  const pattern = /(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g;
  let match;

  while ((match = pattern.exec(body)) !== null && urls.size < 8) {
    const raw = match[1].replace(/&amp;/g, "&");
    urls.add(raw.startsWith("http") ? raw : absoluteUrl(raw));
  }

  return Array.from(urls);
}

function maybeFetchColdAssets(response, tags, route) {
  if (!route.coldAssets || Math.random() > COLD_ASSET_RATE) return;

  const urls = assetUrlsFromHtml(response.body);
  if (urls.length === 0) return;

  const requests = urls.map((url) => [
    "GET",
    url,
    null,
    {
      responseType: "none",
      timeout: "20s",
      tags: {
        ...tags,
        route: `${route.name}_asset`,
        asset: "next_static",
      },
    },
  ]);

  http.batch(requests);
}

export function setup() {
  const res = http.get(`${BASE_URL}/`, { timeout: "20s", tags: { route: "setup" } });
  if (res.status !== 200) {
    throw new Error(`BASE_URL no esta listo: ${BASE_URL} devolvio ${res.status}`);
  }
  return { baseUrl: BASE_URL, profile: PROFILE };
}

export function browse() {
  const route = pickRoute();
  const tags = {
    route: route.name,
    phase: exec.scenario.name,
    profile: PROFILE,
  };

  const res = http.get(absoluteUrl(route.path), {
    redirects: route.redirects ?? 5,
    timeout: "30s",
    tags,
  });

  check(
    res,
    {
      "status esperado": (r) => route.ok.includes(r.status),
      "respuesta con cuerpo": (r) =>
        route.name === "protected_redirect" || String(r.body || "").length > 0,
    },
    tags,
  );

  maybeFetchColdAssets(res, tags, route);

  sleep(Math.random() * 0.8 + 0.2);
}
