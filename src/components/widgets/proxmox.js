"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Boxes,
  CheckCircle2,
  Database,
  Monitor,
  Server,
  ServerCog,
  Unplug,
} from "lucide-react";
import { useProxmox } from "../DashContext";
import { LineChart, Meter } from "../charts";
import { formatBytes, formatDuration, formatRate, severityColor } from "@/lib/format";
import { EmptyState, StatusDot, WidgetHeader } from "./common";
import { cx } from "../ui";

const pct = (used, total) => (used != null && total ? (used / total) * 100 : null);
const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(0)}%`);
const CPU_COLOR = "var(--series-1)";
const MEM_COLOR = "var(--series-2)";

// Shared loading / not-configured / error handling. If Proxmox becomes
// unreachable after a successful load, the last data stays up, marked stale.
function useCluster() {
  const { data, error } = useProxmox();
  if (!data) {
    return {
      view: error ? (
        <EmptyState icon={Unplug} title="Can't reach Proxmox" hint={error} />
      ) : (
        <div className="h-full animate-pulse" />
      ),
    };
  }
  if (!data.configured) {
    return {
      view: (
        <EmptyState
          icon={ServerCog}
          title="Connect Proxmox"
          hint="Set PROXMOX_URL, PROXMOX_TOKEN_ID and PROXMOX_TOKEN_SECRET for the dashboard server, then restart it."
        />
      ),
    };
  }
  return { data, stale: error };
}

function StaleBadge({ error }) {
  if (!error) return null;
  return (
    <span className="flex items-center gap-1" title={error}>
      <AlertTriangle size={12} style={{ color: "var(--warn)" }} />
      Stale
    </span>
  );
}

// A stat whose label carries a line key, so it doubles as the chart legend.
function Stat({ label, value, unit, sub, keyColor, meter }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-fg-3">
        {keyColor && <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: keyColor }} />}
        {label}
      </div>
      <div
        className="font-semibold tracking-tight leading-tight mt-0.5"
        style={{ fontSize: "clamp(18px, 13cqh, 32px)" }}
      >
        {value}
        {unit && <span className="text-fg-3 font-medium text-[0.55em]">{unit}</span>}
      </div>
      {meter != null && (
        <div className="mt-1.5">
          <Meter value={meter} color={severityColor(meter)} height={4} />
        </div>
      )}
      {sub && <div className="text-xs text-fg-3 mt-1 truncate">{sub}</div>}
    </div>
  );
}

function UsageChart({ history }) {
  if (history.length < 2) return null;
  return (
    <LineChart
      series={[
        { key: "cpu", label: "CPU", color: CPU_COLOR, values: history.map((p) => p.cpu) },
        { key: "mem", label: "Memory", color: MEM_COLOR, values: history.map((p) => p.mem) },
      ]}
      times={history.map((p) => p.t)}
      max={100}
      format={(v) => `${v.toFixed(0)}%`}
    />
  );
}

// ---- Cluster overview ------------------------------------------------------

export function ProxmoxClusterWidget({ w, h }) {
  const { data, view, stale } = useCluster();
  if (view) return view;
  const { cluster, totals, history } = data;
  const memPct = pct(totals.memUsed, totals.memTotal);
  const storagePct = pct(totals.storageUsed, totals.storageTotal);
  const title = cluster.name ?? data.nodes[0]?.name ?? "Proxmox";

  const quorum = cluster.standalone
    ? { label: "Standalone", Icon: Server, color: "var(--text-3)" }
    : cluster.quorate
      ? { label: "Quorate", Icon: CheckCircle2, color: "var(--good)" }
      : { label: "No quorum", Icon: AlertTriangle, color: "var(--bad)" };

  const stats = [
    { label: "CPU", value: fmtPct(totals.cpu), sub: `${totals.cores} cores`, meter: totals.cpu, keyColor: CPU_COLOR },
    {
      label: "Memory",
      value: fmtPct(memPct),
      sub: `${formatBytes(totals.memUsed)} of ${formatBytes(totals.memTotal)}`,
      meter: memPct,
      keyColor: MEM_COLOR,
    },
    {
      label: "Guests running",
      value: totals.guestsRunning,
      unit: ` / ${totals.guestsTotal}`,
      sub: `${totals.vms} VMs · ${totals.containers} containers`,
    },
    { label: "Nodes online", value: totals.nodesOnline, unit: ` / ${totals.nodesTotal}`, sub: quorum.label },
    {
      label: "Storage",
      value: fmtPct(storagePct),
      sub: `${formatBytes(totals.storageUsed)} of ${formatBytes(totals.storageTotal)}`,
      meter: storagePct,
    },
  ];
  const shown = stats.slice(0, w >= 6 ? 5 : w >= 4 ? 4 : w >= 3 ? 3 : 2);
  const grid = (
    <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map((s) => (
        <Stat key={s.label} {...s} keyColor={h >= 2 ? s.keyColor : undefined} meter={h >= 2 ? s.meter : undefined} />
      ))}
    </div>
  );

  if (h === 1) return <div className="h-full flex items-center px-4">{grid}</div>;

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <WidgetHeader
        icon={ServerCog}
        title={title}
        right={
          <>
            <StaleBadge error={stale} />
            <span className="flex items-center gap-1">
              <quorum.Icon size={12} style={{ color: quorum.color }} />
              {quorum.label}
            </span>
          </>
        }
      />
      {grid}
      {h >= 3 && history.length > 1 && (
        <div className="flex-1 min-h-0 flex flex-col gap-1">
          <div className="text-[11px] text-fg-3">Cluster usage · last hour</div>
          <div className="flex-1 min-h-0">
            <UsageChart history={history} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Single node -----------------------------------------------------------

export function ProxmoxNodeWidget({ w, h, config }) {
  const { data, view, stale } = useCluster();
  if (view) return view;
  const node = config.node ? data.nodes.find((n) => n.name === config.node) : data.nodes[0];
  if (!node) {
    return <EmptyState icon={Server} title="Node not found" hint={`“${config.node}” isn't part of this cluster.`} />;
  }

  const memPct = pct(node.memUsed, node.memTotal);
  const diskPct = pct(node.diskUsed, node.diskTotal);
  const guests = data.guests.filter((g) => g.node === node.name);
  const running = guests.filter((g) => g.status === "running").length;

  const header = (
    <WidgetHeader
      icon={Server}
      title={node.name}
      right={
        <>
          <StaleBadge error={stale} />
          <span className="flex items-center gap-1.5">
            <StatusDot state={node.online ? "up" : "down"} />
            {node.online ? `up ${formatDuration(node.uptime)}` : "Offline"}
          </span>
        </>
      }
    />
  );

  if (!node.online) {
    return (
      <div className="h-full flex flex-col p-4 gap-3">
        {header}
        <div className="flex-1 grid place-items-center text-sm text-fg-3 text-center">
          This node is offline. Its guests may have migrated or stopped.
        </div>
      </div>
    );
  }

  if (h === 1) {
    return (
      <div className="h-full flex flex-col justify-center gap-2 px-4">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold truncate">{node.name}</span>
          <span className="text-xs text-fg-3">
            {running}/{guests.length} guests
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-fg-3">
          {[
            ["CPU", node.cpu],
            ["Mem", memPct],
          ].map(([label, v]) => (
            <div key={label}>
              <div className="flex justify-between mb-1">
                <span>{label}</span>
                <span className="text-fg font-semibold">{fmtPct(v)}</span>
              </div>
              <Meter value={v} color={severityColor(v)} height={4} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {header}
      <div className={cx("grid gap-4", w >= 5 ? "grid-cols-3" : "grid-cols-2")}>
        <Stat label="CPU" value={fmtPct(node.cpu)} sub={`${node.cores} cores`} keyColor={CPU_COLOR} />
        <Stat
          label="Memory"
          value={fmtPct(memPct)}
          sub={`${formatBytes(node.memUsed)} of ${formatBytes(node.memTotal)}`}
          keyColor={MEM_COLOR}
        />
        {w >= 5 && <Stat label="Guests running" value={running} unit={` / ${guests.length}`} />}
      </div>
      <div className="flex-1 min-h-0">
        <UsageChart history={node.history} />
      </div>
      {h >= 3 && (
        <div className="grid grid-cols-2 gap-4 text-xs text-fg-3 pt-2 border-t border-line">
          <div className="min-w-0">
            <div className="flex justify-between mb-1.5 gap-2">
              <span>Root disk</span>
              <span className="truncate">
                {formatBytes(node.diskUsed)} / {formatBytes(node.diskTotal)} ·{" "}
                <span className="text-fg font-semibold">{fmtPct(diskPct)}</span>
              </span>
            </div>
            <Meter value={diskPct} color={severityColor(diskPct ?? 0)} height={4} />
          </div>
          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
            <span className="flex items-center gap-1">
              <ArrowDown size={12} />
              <span className="text-fg font-medium">{formatRate(node.netin)}</span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp size={12} />
              <span className="text-fg font-medium">{formatRate(node.netout)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Guests (VMs and containers) -------------------------------------------

const SORTS = {
  cpu: (a, b) => (b.cpu ?? -1) - (a.cpu ?? -1),
  mem: (a, b) => (b.memUsed ?? -1) - (a.memUsed ?? -1),
  name: (a, b) => a.name.localeCompare(b.name),
  id: (a, b) => a.id - b.id,
};

export function ProxmoxGuestsWidget({ w, config }) {
  const { data, view, stale } = useCluster();
  if (view) return view;

  const list = data.guests
    .filter((g) => !config.type || config.type === "all" || g.type === config.type)
    .filter(
      (g) =>
        !config.state ||
        config.state === "all" ||
        (config.state === "running" ? g.status === "running" : g.status !== "running"),
    )
    .filter((g) => !config.node || g.node === config.node)
    .sort(SORTS[config.sort] ?? SORTS.cpu);
  const running = list.filter((g) => g.status === "running").length;

  const showMem = w >= 5;
  const showNode = w >= 7;
  const showUptime = w >= 9;
  const columns = [
    "1rem",
    "minmax(0, 1fr)",
    showNode && "6.5rem",
    "3.5rem",
    showMem && "7.5rem",
    showUptime && "4.5rem",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      <WidgetHeader
        icon={Boxes}
        title="VMs & containers"
        right={
          <>
            <StaleBadge error={stale} />
            {running} of {list.length} running
          </>
        }
      />
      <div
        className="grid gap-x-3 px-1 pb-1.5 border-b border-line text-[11px] text-fg-3"
        style={{ gridTemplateColumns: columns }}
      >
        <span />
        <span>Name</span>
        {showNode && <span>Node</span>}
        <span className="text-right">CPU</span>
        {showMem && <span className="text-right">Memory</span>}
        {showUptime && <span className="text-right">Uptime</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar fade-bottom -mt-1 pb-3">
        {list.length === 0 && <div className="text-sm text-fg-3 text-center py-6">No guests match these filters.</div>}
        {list.map((g) => {
          const on = g.status === "running";
          const TypeIcon = g.type === "qemu" ? Monitor : Box;
          return (
            <div
              key={`${g.type}-${g.id}`}
              className="grid gap-x-3 items-center px-1 py-1.5 text-sm border-b border-line/60 tabular-nums"
              style={{ gridTemplateColumns: columns }}
            >
              <StatusDot state={on ? "up" : "unknown"} />
              <span className={cx("flex items-center gap-2 min-w-0", !on && "text-fg-3")}>
                <TypeIcon
                  size={13}
                  className="shrink-0 text-fg-3"
                  aria-label={g.type === "qemu" ? "VM" : "Container"}
                />
                <span className="truncate">{g.name}</span>
                <span className="text-xs text-fg-3 shrink-0">{g.id}</span>
              </span>
              {showNode && <span className="text-xs text-fg-3 truncate">{g.node}</span>}
              <span className={cx("text-right", !on && "text-xs text-fg-3")}>{on ? fmtPct(g.cpu) : g.status}</span>
              {showMem && (
                <span className="text-right text-xs text-fg-2">
                  {on ? `${formatBytes(g.memUsed)} / ${formatBytes(g.memTotal)}` : formatBytes(g.memTotal)}
                </span>
              )}
              {showUptime && (
                <span className="text-right text-xs text-fg-3">{on ? formatDuration(g.uptime) : "—"}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Storage pools ---------------------------------------------------------

export function ProxmoxStorageWidget({ config }) {
  const { data, view, stale } = useCluster();
  if (view) return view;

  const pools = data.storage
    .filter((s) => !config.node || s.nodes.includes(config.node))
    .map((s) => ({ ...s, pct: pct(s.used, s.total) }))
    .sort((a, b) => Number(b.available) - Number(a.available) || (b.pct ?? 0) - (a.pct ?? 0));
  const free = pools.filter((p) => p.available).reduce((acc, p) => acc + ((p.total ?? 0) - (p.used ?? 0)), 0);

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <WidgetHeader
        icon={Database}
        title="Storage pools"
        right={
          <>
            <StaleBadge error={stale} />
            {formatBytes(free)} free
          </>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar fade-bottom flex flex-col gap-3 pb-3">
        {pools.map((p) => (
          <div key={p.id}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="text-[11px] text-fg-3 truncate">
                  {[p.type, p.shared ? "shared" : p.nodes[0]].filter(Boolean).join(" · ")}
                </span>
              </div>
              <span className="text-xs text-fg-3 shrink-0 tabular-nums">
                {p.available ? (
                  <>
                    {formatBytes(p.used)} / {formatBytes(p.total)} ·{" "}
                    <span className="text-fg font-semibold">{fmtPct(p.pct)}</span>
                  </>
                ) : (
                  "Unavailable"
                )}
              </span>
            </div>
            {p.available && <Meter value={p.pct} color={severityColor(p.pct ?? 0)} height={5} />}
          </div>
        ))}
      </div>
    </div>
  );
}
