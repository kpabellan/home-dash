import { ProxmoxError, proxmoxConfig, pveGet } from "@/lib/proxmox";

export const dynamic = "force-dynamic";

const LIVE_MS = 4000;
// Proxmox writes its RRD history once a minute, so there's no point asking sooner.
const HISTORY_MS = 60000;
const HISTORY_POINTS = 60;

// Small TTL cache that also coalesces concurrent requests for the same key.
const cache = new Map();
function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit?.value && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
  if (hit?.pending) return hit.pending;
  const pending = fn().then(
    (value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    },
    (err) => {
      cache.set(key, { at: hit?.at, value: hit?.value });
      throw err;
    },
  );
  cache.set(key, { ...hit, pending });
  return pending;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function nodeHistory(cfg, node) {
  return cached(`rrd:${node}`, HISTORY_MS, async () => {
    const points = await pveGet(cfg, `/nodes/${encodeURIComponent(node)}/rrddata?timeframe=hour&cf=AVERAGE`);
    return (points ?? [])
      .filter((p) => num(p.time) != null)
      .slice(-HISTORY_POINTS)
      .map((p) => ({
        t: p.time * 1000,
        cpu: num(p.cpu),
        cores: num(p.maxcpu),
        mem: num(p.memused ?? p.mem),
        memTotal: num(p.memtotal ?? p.maxmem),
        netin: num(p.netin),
        netout: num(p.netout),
      }));
  });
}

// Weighted cluster-wide series: CPU by core count, memory by total RAM.
function clusterHistory(nodes) {
  const byTime = new Map();
  for (const node of nodes) {
    for (const p of node.history) {
      const acc = byTime.get(p.t) ?? { t: p.t, busy: 0, cores: 0, mem: 0, memTotal: 0, netin: 0, netout: 0 };
      if (p.cpu != null && p.cores) {
        acc.busy += p.cpu * p.cores;
        acc.cores += p.cores;
      }
      if (p.mem != null && p.memTotal) {
        acc.mem += p.mem;
        acc.memTotal += p.memTotal;
      }
      acc.netin += p.netin ?? 0;
      acc.netout += p.netout ?? 0;
      byTime.set(p.t, acc);
    }
  }
  return [...byTime.values()]
    .sort((a, b) => a.t - b.t)
    .map((a) => ({
      t: a.t,
      cpu: a.cores ? (a.busy / a.cores) * 100 : null,
      mem: a.memTotal ? (a.mem / a.memTotal) * 100 : null,
      netin: a.netin,
      netout: a.netout,
    }));
}

async function snapshot(cfg) {
  const [resources, status] = await Promise.all([
    cached("resources", LIVE_MS, () => pveGet(cfg, "/cluster/resources")),
    cached("status", LIVE_MS, () => pveGet(cfg, "/cluster/status")),
  ]);

  const clusterEntry = status.find((s) => s.type === "cluster");
  const memberOnline = new Map(status.filter((s) => s.type === "node").map((s) => [s.name, s.online === 1]));

  const rawNodes = resources.filter((r) => r.type === "node");
  const rawHistory = [];
  const nodes = await Promise.all(
    rawNodes.map(async (n) => {
      const online = n.status === "online" || memberOnline.get(n.node) === true;
      const history = online ? await nodeHistory(cfg, n.node).catch(() => []) : [];
      const last = history.at(-1);
      rawHistory.push({ history });
      return {
        name: n.node,
        online,
        cpu: online ? (num(n.cpu) ?? 0) * 100 : null,
        cores: num(n.maxcpu),
        memUsed: num(n.mem),
        memTotal: num(n.maxmem),
        diskUsed: num(n.disk),
        diskTotal: num(n.maxdisk),
        uptime: num(n.uptime),
        netin: last?.netin ?? null,
        netout: last?.netout ?? null,
        history: history.map((p) => ({
          t: p.t,
          cpu: p.cpu != null ? p.cpu * 100 : null,
          mem: p.mem != null && p.memTotal ? (p.mem / p.memTotal) * 100 : null,
          netin: p.netin,
          netout: p.netout,
        })),
      };
    }),
  );
  nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const guests = resources
    .filter((r) => (r.type === "qemu" || r.type === "lxc") && !r.template)
    .map((g) => ({
      id: g.vmid,
      name: g.name ?? `${g.type === "qemu" ? "VM" : "CT"} ${g.vmid}`,
      type: g.type,
      node: g.node,
      status: g.status,
      cpu: g.status === "running" ? (num(g.cpu) ?? 0) * 100 : null,
      cores: num(g.maxcpu),
      memUsed: g.status === "running" ? num(g.mem) : null,
      memTotal: num(g.maxmem),
      diskUsed: num(g.disk),
      diskTotal: num(g.maxdisk),
      uptime: num(g.uptime),
      tags: g.tags
        ? String(g.tags)
            .split(/[;,\s]+/)
            .filter(Boolean)
        : [],
    }));

  // Shared storage (NFS, Ceph, PBS…) is reported once per node; show it once.
  const pools = new Map();
  for (const s of resources.filter((r) => r.type === "storage")) {
    const key = s.shared ? `shared:${s.storage}` : `${s.node}:${s.storage}`;
    const existing = pools.get(key);
    if (existing) {
      existing.nodes.push(s.node);
      continue;
    }
    pools.set(key, {
      id: key,
      name: s.storage,
      type: s.plugintype ?? null,
      shared: Boolean(s.shared),
      nodes: [s.node],
      available: s.status === "available",
      used: num(s.disk),
      total: num(s.maxdisk),
      content: s.content ? String(s.content).split(",") : [],
    });
  }
  const storage = [...pools.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.nodes[0].localeCompare(b.nodes[0]),
  );

  const online = nodes.filter((n) => n.online);
  const sum = (list, key) => list.reduce((acc, x) => acc + (x[key] ?? 0), 0);
  const cores = sum(online, "cores");
  const busy = online.reduce((acc, n) => acc + ((n.cpu ?? 0) / 100) * (n.cores ?? 0), 0);
  const counted = storage.filter((s) => s.available && s.total);

  return {
    configured: true,
    fetchedAt: Date.now(),
    cluster: {
      name: clusterEntry?.name ?? null,
      standalone: !clusterEntry,
      quorate: clusterEntry ? clusterEntry.quorate === 1 : null,
    },
    totals: {
      nodesOnline: online.length,
      nodesTotal: nodes.length,
      cpu: cores ? (busy / cores) * 100 : null,
      cores,
      memUsed: sum(online, "memUsed"),
      memTotal: sum(online, "memTotal"),
      storageUsed: sum(counted, "used"),
      storageTotal: sum(counted, "total"),
      guestsRunning: guests.filter((g) => g.status === "running").length,
      guestsTotal: guests.length,
      vms: guests.filter((g) => g.type === "qemu").length,
      containers: guests.filter((g) => g.type === "lxc").length,
    },
    history: clusterHistory(rawHistory),
    nodes,
    guests,
    storage,
  };
}

export async function GET() {
  const cfg = proxmoxConfig();
  if (!cfg) return Response.json({ configured: false });
  try {
    return Response.json(await snapshot(cfg));
  } catch (err) {
    const message = err instanceof ProxmoxError ? err.message : "Couldn't load Proxmox data";
    return Response.json({ configured: true, error: message }, { status: 502 });
  }
}
