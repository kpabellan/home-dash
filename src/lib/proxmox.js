import http from "http";
import https from "https";

const TIMEOUT_MS = 6000;

// PROXMOX_URL may list several nodes of the same cluster (comma-separated);
// they are tried in order so the dashboard keeps working if one node is down.
export function proxmoxConfig() {
  const hosts = (process.env.PROXMOX_URL ?? "")
    .split(",")
    .map((s) =>
      s
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api2\/json$/, ""),
    )
    .filter(Boolean);
  const tokenId = process.env.PROXMOX_TOKEN_ID?.trim();
  const secret = process.env.PROXMOX_TOKEN_SECRET?.trim();
  if (!hosts.length || !tokenId || !secret) return null;
  return {
    hosts,
    auth: `PVEAPIToken=${tokenId}=${secret}`,
    // Proxmox ships with a self-signed certificate, so verification is opt-in.
    verifyTls: /^(1|true|yes)$/i.test(process.env.PROXMOX_VERIFY_TLS ?? ""),
  };
}

export class ProxmoxError extends Error {
  constructor(message, status = null) {
    super(message);
    this.status = status;
  }
}

function request(base, path, cfg) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(`${base}/api2/json${path}`);
    } catch {
      reject(new ProxmoxError(`Invalid PROXMOX_URL: ${base}`));
      return;
    }

    const lib = url.protocol === "http:" ? http : https;
    const req = lib.request(
      url,
      {
        method: "GET",
        timeout: TIMEOUT_MS,
        rejectUnauthorized: cfg.verifyTls,
        headers: { Authorization: cfg.auth, Accept: "application/json" },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode === 401) {
            reject(
              new ProxmoxError("Proxmox rejected the API token. Check PROXMOX_TOKEN_ID and PROXMOX_TOKEN_SECRET.", 401),
            );
          } else if (res.statusCode === 403) {
            reject(new ProxmoxError("The API token lacks permission. Give it the PVEAuditor role on /.", 403));
          } else if (res.statusCode >= 400) {
            reject(new ProxmoxError(`Proxmox returned HTTP ${res.statusCode}`, res.statusCode));
          } else {
            try {
              resolve(JSON.parse(body).data);
            } catch {
              reject(new ProxmoxError("Proxmox returned a response that isn't JSON"));
            }
          }
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", (err) => reject(new ProxmoxError(`Can't reach ${url.host}: ${err.code ?? err.message}`)));
    req.end();
  });
}

let preferred = 0;

// GET from the cluster, failing over between hosts on network and 5xx errors.
// 4xx errors (bad token, missing permission) are not retried: every node
// shares the same token store, so another node would answer the same.
export async function pveGet(cfg, path) {
  let lastError;
  for (let i = 0; i < cfg.hosts.length; i++) {
    const idx = (preferred + i) % cfg.hosts.length;
    try {
      const data = await request(cfg.hosts[idx], path, cfg);
      preferred = idx;
      return data;
    } catch (err) {
      if (err.status && err.status < 500) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
