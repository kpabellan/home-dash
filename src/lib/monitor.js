import http from "http";
import https from "https";
import { cachedLookup } from "./dnsCache";
import { loadServices } from "./services";

// Health checks run continuously on the server while anyone has the dashboard
// open, and each result is pushed to the browser the moment it lands.
//
// Accuracy: a service is only reported down after three failed attempts over
// a few seconds, so a dropped connection or a slow first byte doesn't flip it
// red. A down service is rechecked every few seconds, so recovery shows fast.

const INTERVAL_MS = (Number(process.env.STATUS_INTERVAL) || 15) * 1000;
const DOWN_RECHECK_MS = 5000;
const TIMEOUT_MS = 8000;
const RETRY_DELAYS_MS = [1000, 3000];
const CONCURRENCY = 6;
const HISTORY = 30;
// Stop checking once nobody has looked for this long.
const IDLE_MS = 5 * 60 * 1000;
const RELOAD_SERVICES_MS = 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Any HTTP response below 500 counts as "up" (401/403 just means the service
// wants auth). Self-signed certificates are accepted since homelab gear like
// OPNsense or Proxmox usually ships with one.
function probe(url) {
  return new Promise((resolve) => {
    const started = performance.now();
    let target;
    try {
      target = new URL(url);
    } catch {
      resolve({ up: false, code: null, latency: null, error: "Invalid URL" });
      return;
    }

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      resolve(result);
    };

    const lib = target.protocol === "http:" ? http : https;
    const req = lib.request(
      target,
      {
        method: "GET",
        rejectUnauthorized: false,
        lookup: cachedLookup,
        // A fresh connection every time: a reused socket the server already
        // closed fails with ECONNRESET even though the service is fine.
        agent: false,
        headers: { "User-Agent": "HomeDash/2.0 (+status-check)", Connection: "close" },
      },
      (res) => {
        const latency = Math.round(performance.now() - started);
        res.destroy();
        finish({
          up: res.statusCode < 500,
          code: res.statusCode,
          latency,
          error: res.statusCode >= 500 ? `HTTP ${res.statusCode}` : null,
        });
      },
    );
    // One deadline for the whole attempt (DNS, connect, TLS and first byte).
    const deadline = setTimeout(
      () => req.destroy(Object.assign(new Error("Timed out"), { code: "TIMEOUT" })),
      TIMEOUT_MS,
    );
    req.on("error", (err) => finish({ up: false, code: null, latency: null, error: err.code ?? err.message }));
    req.end();
  });
}

function createMonitor() {
  const states = new Map(); // id -> { result, history, nextAt, busy }
  const listeners = new Set();
  let services = [];
  let servicesAt = 0;
  let timer = null;
  let inFlight = 0;
  let lastSeen = 0;

  const refreshServices = () => {
    services = loadServices();
    servicesAt = Date.now();
    const ids = new Set(services.map((s) => s.id));
    for (const id of states.keys()) if (!ids.has(id)) states.delete(id);
    for (const s of services) {
      if (!states.has(s.id)) states.set(s.id, { result: null, history: [], nextAt: 0, busy: false });
    }
  };

  const check = async (service, state) => {
    state.busy = true;
    inFlight++;
    try {
      const wasUp = state.result?.up !== false;
      let result = await probe(service.url);
      // Confirm a failure before reporting it. Already-down services skip the
      // retries so a recovery is picked up on the next quick recheck.
      for (const delay of wasUp ? RETRY_DELAYS_MS : []) {
        if (result.up) break;
        await sleep(delay);
        result = await probe(service.url);
      }
      const now = Date.now();
      const changed = !state.result || state.result.up !== result.up;
      state.result = { ...result, checkedAt: now, since: changed ? now : state.result.since };
      state.history = [...state.history, state.result].slice(-HISTORY);
      // A little jitter keeps the checks spread out instead of bunching up.
      state.nextAt = now + (result.up ? INTERVAL_MS * (0.9 + Math.random() * 0.2) : DOWN_RECHECK_MS);
      for (const fn of listeners) fn({ id: service.id, result: state.result });
    } finally {
      state.busy = false;
      inFlight--;
    }
  };

  const loop = () => {
    if (Date.now() - lastSeen > IDLE_MS && listeners.size === 0) {
      clearInterval(timer);
      timer = null;
      return;
    }
    if (Date.now() - servicesAt > RELOAD_SERVICES_MS) refreshServices();
    const now = Date.now();
    const due = services
      .map((s) => [s, states.get(s.id)])
      .filter(([, st]) => !st.busy && st.nextAt <= now)
      .sort(([, a], [, b]) => a.nextAt - b.nextAt);
    for (const [s, st] of due) {
      if (inFlight >= CONCURRENCY) break;
      check(s, st);
    }
  };

  const start = () => {
    lastSeen = Date.now();
    if (timer) return;
    refreshServices();
    // Waking up after a pause: everything is due right away.
    for (const st of states.values()) st.nextAt = 0;
    timer = setInterval(loop, 250);
    loop();
  };

  return {
    snapshot() {
      start();
      const out = { services: {}, history: {} };
      for (const s of services) {
        const st = states.get(s.id);
        if (st?.result) out.services[s.id] = st.result;
        out.history[s.id] = st?.history ?? [];
      }
      return out;
    },
    subscribe(fn) {
      start();
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
        lastSeen = Date.now();
      };
    },
    // Resolves once every service has a result, or after `ms`.
    async ready(ms) {
      start();
      const until = Date.now() + ms;
      while (Date.now() < until && services.some((s) => !states.get(s.id)?.result)) await sleep(50);
    },
  };
}

// One monitor per server process, even if route bundles load this module twice.
export const monitor = (globalThis.__homeDashMonitor ??= createMonitor());
