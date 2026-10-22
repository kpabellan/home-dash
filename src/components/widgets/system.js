"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  ServerCog,
  Thermometer,
  Unplug,
} from "lucide-react";
import { useDash, useProxmox, useSystem } from "../DashContext";
import { LineChart, Meter, Ring } from "../charts";
import { formatBytes, formatDuration, formatRate, severityColor } from "@/lib/format";
import { EmptyState, WidgetHeader } from "./common";

const PLATFORM = { win32: "Windows", linux: "Linux", darwin: "macOS", freebsd: "FreeBSD" };

const pct = (used, total) => (used != null && total ? (used / total) * 100 : null);

function Loading() {
  return <div className="h-full animate-pulse" />;
}

// ---- Data sources ----------------------------------------------------------
//
// Each metric tile shows one source, chosen in its settings:
//   "auto" (default) - the Proxmox cluster when connected, otherwise this server
//   "host"           - the machine running Home Dash
//   "cluster"        - the whole Proxmox cluster
//   "node:<name>"    - one Proxmox node
// Both sources are normalized into the same shape so the widgets don't care.

function fromHost({ data, error, history }) {
  if (!data) {
    return {
      view: error ? (
        <EmptyState icon={Unplug} title="Metrics offline" hint="The dashboard server isn't responding." />
      ) : (
        <Loading />
      ),
    };
  }
  const { cpu, memory } = data;
  const disks = (data.disks ?? []).map((d) => ({ key: d.path, label: d.label, used: d.used, total: d.total }));
  return {
    label: null,
    cpu: {
      usage: cpu.usage,
      cores: cpu.cores,
      load: cpu.load,
      temp: cpu.temp,
      history: history.map((p) => ({ t: p.t, v: p.data.cpu.usage })),
    },
    memory: {
      used: memory.used,
      total: memory.total,
      history: history.map((p) => ({ t: p.t, v: pct(p.data.memory.used, p.data.memory.total) })),
    },
    network: data.network && {
      rx: data.network.rxRate,
      tx: data.network.txRate,
      history: history
        .filter((p) => p.data.network && !p.data.network.warmup)
        .map((p) => ({ t: p.t, rx: p.data.network.rxRate, tx: p.data.network.txRate })),
    },
    disks,
    diskNoun: "disks",
    diskPct: disks[0] ? pct(disks[0].used, disks[0].total) : null,
    system: {
      name: data.hostname,
      sub: `${PLATFORM[data.platform] ?? data.platform} · up ${formatDuration(data.uptime)}`,
      model: cpu.model,
    },
    emptyDisks: "Set DISK_PATHS to choose mounts.",
  };
}

const poolRow = (s) => ({
  key: s.id,
  label: s.name,
  detail: s.shared ? "shared" : s.nodes[0],
  used: s.used,
  total: s.total,
});

function fromProxmox({ data, error }, source) {
  if (!data) {
    return {
      view: error ? <EmptyState icon={Unplug} title="Can't reach Proxmox" hint={error} /> : <Loading />,
    };
  }
  // Fullest first, so the pools that matter are visible even in a short tile.
  const pools = data.storage
    .filter((s) => s.available && s.total)
    .sort((a, b) => (b.used ?? 0) / b.total - (a.used ?? 0) / a.total);

  if (source.startsWith("node:")) {
    const name = source.slice(5);
    const node = data.nodes.find((n) => n.name === name);
    if (!node) {
      return {
        view: <EmptyState icon={Server} title="Node not found" hint={`“${name}” isn't part of this cluster.`} />,
      };
    }
    if (!node.online) return { view: <EmptyState icon={Server} title={`${name} is offline`} /> };
    const guests = data.guests.filter((g) => g.node === name);
    const running = guests.filter((g) => g.status === "running").length;
    return {
      label: name,
      stale: error,
      cpu: { usage: node.cpu, cores: node.cores, history: node.history.map((p) => ({ t: p.t, v: p.cpu })) },
      memory: {
        used: node.memUsed,
        total: node.memTotal,
        history: node.history.map((p) => ({ t: p.t, v: p.mem })),
      },
      network: {
        rx: node.netin,
        tx: node.netout,
        history: node.history.map((p) => ({ t: p.t, rx: p.netin, tx: p.netout })),
      },
      disks: [
        { key: "root", label: "Root disk", used: node.diskUsed, total: node.diskTotal },
        ...pools.filter((s) => s.nodes.includes(name)).map(poolRow),
      ],
      diskNoun: "volumes",
      diskPct: pct(node.diskUsed, node.diskTotal),
      system: { name, sub: `up ${formatDuration(node.uptime)} · ${running}/${guests.length} guests running` },
      emptyDisks: "This node reports no storage.",
    };
  }

  const t = data.totals;
  const online = data.nodes.filter((n) => n.online);
  const sum = (key) => online.reduce((acc, n) => acc + (n[key] ?? 0), 0);
  return {
    label: data.cluster.name ?? "Proxmox",
    stale: error,
    cpu: { usage: t.cpu, cores: t.cores, history: data.history.map((p) => ({ t: p.t, v: p.cpu })) },
    memory: { used: t.memUsed, total: t.memTotal, history: data.history.map((p) => ({ t: p.t, v: p.mem })) },
    network: {
      rx: sum("netin"),
      tx: sum("netout"),
      history: data.history.map((p) => ({ t: p.t, rx: p.netin, tx: p.netout })),
    },
    disks: pools.map(poolRow),
    diskNoun: "pools",
    diskPct: pct(t.storageUsed, t.storageTotal),
    system: {
      name: data.cluster.name ?? data.nodes[0]?.name ?? "Proxmox",
      sub: `${t.nodesOnline}/${t.nodesTotal} nodes online · ${t.guestsRunning}/${t.guestsTotal} guests running`,
    },
    emptyDisks: "No storage pools reported.",
  };
}

function useMetrics(config = {}) {
  const { proxmoxAvailable } = useDash();
  const source = config.source || "auto";
  const wantsProxmox = proxmoxAvailable && source !== "host";
  const pve = useProxmox(wantsProxmox);
  // In automatic mode, a configured-but-failing Proxmox falls back to this
  // server rather than turning every metric tile into an error.
  const useHost = !wantsProxmox || (source === "auto" && !pve.data && Boolean(pve.error));
  const host = useSystem(useHost);

  if (!proxmoxAvailable && source !== "auto" && source !== "host") {
    return {
      view: (
        <EmptyState
          icon={ServerCog}
          title="Proxmox isn't connected"
          hint="Set PROXMOX_URL, PROXMOX_TOKEN_ID and PROXMOX_TOKEN_SECRET, or show this server instead."
        />
      ),
    };
  }
  if (useHost) return fromHost(host);
  return fromProxmox(pve, source === "auto" ? "cluster" : source);
}

// ---- Shared pieces ---------------------------------------------------------

const titled = (base, m) => (m.label ? `${base} · ${m.label}` : base);

function Stale({ m }) {
  if (!m.stale) return null;
  return (
    <span className="flex items-center gap-1" title={`Showing the last data received: ${m.stale}`}>
      <AlertTriangle size={12} style={{ color: "var(--warn)" }} />
      Stale
    </span>
  );
}

function BigValue({ children, unit }) {
  return (
    <div className="font-semibold tracking-tight leading-none" style={{ fontSize: "clamp(24px, 20cqh, 52px)" }}>
      {children}
      {unit && <span className="text-fg-3 font-medium text-[0.5em] ml-0.5">{unit}</span>}
    </div>
  );
}

function StatTile({ icon, title, right, value, unit, sub, h, percent, chart }) {
  if (h === 1) {
    return (
      <div className="h-full flex flex-col justify-center gap-2 px-4">
        <div className="flex items-baseline justify-between gap-2">
          <WidgetHeader icon={icon} title={title} />
          <span className="text-lg font-semibold">
            {value}
            {unit && <span className="text-fg-3 text-sm">{unit}</span>}
          </span>
        </div>
        {percent != null && <Meter value={percent} color={severityColor(percent)} />}
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col p-4 gap-1">
      <WidgetHeader icon={icon} title={title} right={right} />
      <div className="mt-1.5">
        <BigValue unit={unit}>{value}</BigValue>
        {sub && <div className="text-xs text-fg-3 mt-1.5 truncate">{sub}</div>}
      </div>
      <div className="flex-1 min-h-0 mt-2">{chart}</div>
    </div>
  );
}

const fmtPct = (v) => (v == null ? "—" : v.toFixed(0));

// ---- Widgets ---------------------------------------------------------------

export function CpuWidget({ h, config }) {
  const m = useMetrics(config);
  if (m.view) return m.view;
  const { cpu } = m;
  const sub = [`${cpu.cores} cores`, cpu.load ? `load ${cpu.load[0].toFixed(2)}` : null].filter(Boolean).join(" · ");

  return (
    <StatTile
      icon={Cpu}
      title={titled("CPU", m)}
      h={h}
      value={fmtPct(cpu.usage)}
      unit="%"
      percent={cpu.usage}
      sub={sub}
      right={
        m.stale ? (
          <Stale m={m} />
        ) : (
          cpu.temp != null && (
            <span className="flex items-center gap-0.5">
              <Thermometer size={12} />
              {cpu.temp.toFixed(0)}°C
            </span>
          )
        )
      }
      chart={
        <LineChart
          series={[{ key: "cpu", label: "CPU", color: "var(--accent)", values: cpu.history.map((p) => p.v) }]}
          times={cpu.history.map((p) => p.t)}
          max={100}
          format={(v) => `${v.toFixed(0)}%`}
        />
      }
    />
  );
}

export function MemoryWidget({ h, config }) {
  const m = useMetrics(config);
  if (m.view) return m.view;
  const { memory } = m;
  const value = pct(memory.used, memory.total);

  return (
    <StatTile
      icon={MemoryStick}
      title={titled("Memory", m)}
      h={h}
      value={fmtPct(value)}
      unit="%"
      percent={value}
      sub={`${formatBytes(memory.used)} of ${formatBytes(memory.total)}`}
      right={<Stale m={m} />}
      chart={
        <LineChart
          series={[{ key: "mem", label: "Memory", color: "var(--accent)", values: memory.history.map((p) => p.v) }]}
          times={memory.history.map((p) => p.t)}
          max={100}
          format={(v) => `${v.toFixed(0)}%`}
        />
      }
    />
  );
}

export function StorageWidget({ h, config }) {
  const m = useMetrics(config);
  if (m.view) return m.view;
  const disks = m.disks.filter((d) => d.total);
  if (!disks.length) return <EmptyState icon={HardDrive} title="No storage" hint={m.emptyDisks} />;

  const used = disks.reduce((a, d) => a + (d.used ?? 0), 0);
  const total = disks.reduce((a, d) => a + d.total, 0);
  const totalPct = (used / total) * 100;

  const diskRows = disks.map((d) => {
    const p = pct(d.used, d.total) ?? 0;
    return (
      <div key={d.key}>
        <div className="flex items-baseline justify-between gap-2 mb-1.5 text-xs">
          <span className="min-w-0 truncate">
            <span className="font-medium text-fg-2">{d.label}</span>
            {d.detail && <span className="text-fg-3"> · {d.detail}</span>}
          </span>
          <span className="text-fg-3 shrink-0">
            {formatBytes(d.used)} / {formatBytes(d.total)} ·{" "}
            <span className="text-fg font-semibold">{p.toFixed(0)}%</span>
          </span>
        </div>
        <Meter value={p} color={severityColor(p)} />
      </div>
    );
  });

  if (h === 1) {
    return <div className="h-full flex flex-col justify-center gap-3 px-4 overflow-hidden">{diskRows}</div>;
  }

  return (
    <div className="h-full flex flex-col p-4 gap-1">
      <WidgetHeader
        icon={HardDrive}
        title={titled("Storage", m)}
        right={m.stale ? <Stale m={m} /> : `${formatBytes(total - used)} free`}
      />
      <div className="mt-1.5">
        <BigValue unit="%">{totalPct.toFixed(0)}</BigValue>
        {/* With several disks in a short tile, the per-disk rows below already carry these figures. */}
        {(disks.length === 1 || h >= 3) && (
          <div className="text-xs text-fg-3 mt-1.5 truncate">
            {formatBytes(used)} used of {formatBytes(total)}
            {disks.length > 1 && ` across ${disks.length} ${m.diskNoun}`}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3 mt-3">
        <div className="mt-auto" />
        {diskRows}
      </div>
    </div>
  );
}

function RateStat({ icon: Icon, label, value, color }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-fg-3">
        <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />
        <Icon size={12} />
        {label}
      </div>
      <div className="font-semibold tracking-tight mt-0.5 truncate" style={{ fontSize: "clamp(16px, 13cqh, 30px)" }}>
        {formatRate(value)}
      </div>
    </div>
  );
}

export function NetworkWidget({ h, config }) {
  const m = useMetrics(config);
  if (m.view) return m.view;
  const net = m.network;
  if (!net) {
    return <EmptyState icon={Network} title="Network stats unavailable" hint="Supported on Linux and Windows hosts." />;
  }

  const series = [
    { key: "rx", label: "Download", color: "var(--series-1)", values: net.history.map((p) => p.rx) },
    { key: "tx", label: "Upload", color: "var(--series-2)", values: net.history.map((p) => p.tx) },
  ];

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      {h > 1 && <WidgetHeader icon={Network} title={titled("Network", m)} right={<Stale m={m} />} />}
      <div className="grid grid-cols-2 gap-3">
        <RateStat icon={ArrowDown} label="Down" value={net.rx} color="var(--series-1)" />
        <RateStat icon={ArrowUp} label="Up" value={net.tx} color="var(--series-2)" />
      </div>
      {h > 1 && (
        <div className="flex-1 min-h-0 mt-1">
          <LineChart series={series} times={net.history.map((p) => p.t)} format={formatRate} />
        </div>
      )}
    </div>
  );
}

export function SystemWidget({ w, h, config }) {
  const m = useMetrics(config);
  if (m.view) return m.view;
  const memPct = pct(m.memory.used, m.memory.total);
  const ringSize = h === 1 ? 44 : Math.min(84, 26 + h * 18);

  const rings = [
    { label: "CPU", value: m.cpu.usage },
    { label: "RAM", value: memPct },
    ...(m.diskPct != null ? [{ label: m.diskNoun === "pools" ? "Storage" : "Disk", value: m.diskPct }] : []),
  ].filter((r) => r.value != null);

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="min-w-0">
        <WidgetHeader icon={m.label ? ServerCog : Server} title="System" right={<Stale m={m} />} />
        <div className="text-lg font-semibold mt-1 truncate">{m.system.name}</div>
        <div className="text-xs text-fg-3 truncate">{m.system.sub}</div>
      </div>
      {(h > 1 || w >= 5) && (
        <div className="flex-1 min-h-0 flex items-center justify-around gap-2">
          {rings.map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-1.5">
              <Ring value={r.value} color={severityColor(r.value)} size={ringSize} stroke={ringSize > 60 ? 7 : 5}>
                <span className="text-sm font-semibold">{r.value.toFixed(0)}%</span>
              </Ring>
              <span className="text-xs text-fg-3">{r.label}</span>
            </div>
          ))}
        </div>
      )}
      {h >= 3 && m.system.model && <div className="text-xs text-fg-3 truncate">{m.system.model}</div>}
    </div>
  );
}
