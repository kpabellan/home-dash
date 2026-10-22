import http from "http";
import https from "https";
import { loadServices } from "@/lib/services";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 5000;
const CACHE_MS = 10000;

let cache = { at: 0, data: null, pending: null };

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

    const lib = target.protocol === "http:" ? http : https;
    const req = lib.request(
      target,
      {
        method: "GET",
        timeout: TIMEOUT_MS,
        rejectUnauthorized: false,
        headers: { "User-Agent": "HomeDash/2.0 (+status-check)" },
      },
      (res) => {
        const latency = Math.round(performance.now() - started);
        res.destroy();
        resolve({
          up: res.statusCode < 500,
          code: res.statusCode,
          latency,
          error: res.statusCode >= 500 ? `HTTP ${res.statusCode}` : null,
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", (err) => {
      resolve({ up: false, code: null, latency: null, error: err.code ?? err.message });
    });
    req.end();
  });
}

async function checkAll() {
  const services = loadServices();
  const results = await Promise.all(services.map((s) => probe(s.url)));
  const data = {};
  services.forEach((s, i) => {
    data[s.id] = results[i];
  });
  return { checkedAt: Date.now(), services: data };
}

export async function GET() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    return Response.json(cache.data);
  }
  if (!cache.pending) {
    cache.pending = checkAll()
      .then((data) => {
        cache = { at: Date.now(), data, pending: null };
        return data;
      })
      .catch((err) => {
        cache.pending = null;
        throw err;
      });
  }
  try {
    return Response.json(await cache.pending);
  } catch {
    return Response.json({ error: "Status check failed" }, { status: 500 });
  }
}
