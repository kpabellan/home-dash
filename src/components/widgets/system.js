"use client";

import { ArrowDown, ArrowUp, Cpu, HardDrive, MemoryStick, Network, Server, Thermometer, Unplug } from "lucide-react";
import { useSystem } from "../DashContext";
import { LineChart, Meter, Ring } from "../charts";
import { formatBytes, formatDuration, formatRate, severityColor } from "@/lib/format";
import { EmptyState, WidgetHeader } from "./common";

const PLATFORM = { win32: "Windows", linux: "Linux", darwin: "macOS", freebsd: "FreeBSD" };

function useMetrics() {
  const { data, error, history } = useSystem();
  return { data, error, history };
}

function Loading() {
  return <div className="h-full animate-pulse" />;
}

function Offline() {
  return <EmptyState icon={Unplug} title="Metrics offline" hint="The dashboard server isn't responding." />;
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

export function CpuWidget({ h }) {
  const { data, error, history } = useMetrics();
  if (!data) return error ? <Offline /> : <Loading />;
  const { cpu } = data;
  const sub = [`${cpu.cores} cores`, cpu.load ? `load ${cpu.load[0].toFixed(2)}` : null].filter(Boolean).join(" · ");

  return (
    <StatTile
      icon={Cpu}
      title="CPU"
      h={h}
      value={cpu.usage.toFixed(0)}
      unit="%"
      percent={cpu.usage}
      sub={sub}
      right={
        cpu.temp != null && (
          <span className="flex items-center gap-0.5">
            <Thermometer size={12} />
            {cpu.temp.toFixed(0)}°C
          </span>
        )
      }
      chart={
        <LineChart
          series={[{ key: "cpu", label: "CPU", color: "var(--accent)", values: history.map((p) => p.data.cpu.usage) }]}
          times={history.map((p) => p.t)}
          max={100}
          format={(v) => `${v.toFixed(0)}%`}
        />
      }
    />
  );
}

export function MemoryWidget({ h }) {
  const { data, error, history } = useMetrics();
  if (!data) return error ? <Offline /> : <Loading />;
  const { memory } = data;
  const pct = (memory.used / memory.total) * 100;

  return (
    <StatTile
      icon={MemoryStick}
      title="Memory"
      h={h}
      value={pct.toFixed(0)}
      unit="%"
      percent={pct}
      sub={`${formatBytes(memory.used)} of ${formatBytes(memory.total)}`}
      chart={
        <LineChart
          series={[
            {
              key: "mem",
              label: "Memory",
              color: "var(--accent)",
              values: history.map((p) => (p.data.memory.used / p.data.memory.total) * 100),
            },
          ]}
          times={history.map((p) => p.t)}
          max={100}
          format={(v) => `${v.toFixed(0)}%`}
        />
      }
    />
  );
}

export function StorageWidget({ h }) {
  const { data, error } = useMetrics();
  if (!data) return error ? <Offline /> : <Loading />;
  const disks = data.disks ?? [];
  if (!disks.length) return <EmptyState icon={HardDrive} title="No disks" hint="Set DISK_PATHS to choose mounts." />;

  const used = disks.reduce((a, d) => a + d.used, 0);
  const total = disks.reduce((a, d) => a + d.total, 0);

  const totalPct = (used / total) * 100;

  const diskRows = disks.map((d) => {
    const pct = (d.used / d.total) * 100;
    return (
      <div key={d.path}>
        <div className="flex items-baseline justify-between gap-2 mb-1.5 text-xs">
          <span className="font-medium text-fg-2 truncate">{d.label}</span>
          <span className="text-fg-3">
            {formatBytes(d.used)} / {formatBytes(d.total)} ·{" "}
            <span className="text-fg font-semibold">{pct.toFixed(0)}%</span>
          </span>
        </div>
        <Meter value={pct} color={severityColor(pct)} />
      </div>
    );
  });

  if (h === 1) {
    return <div className="h-full flex flex-col justify-center gap-3 px-4 overflow-hidden">{diskRows}</div>;
  }

  return (
    <div className="h-full flex flex-col p-4 gap-1">
      <WidgetHeader icon={HardDrive} title="Storage" right={`${formatBytes(total - used)} free`} />
      <div className="mt-1.5">
        <BigValue unit="%">{totalPct.toFixed(0)}</BigValue>
        {/* With several disks in a short tile, the per-disk rows below already carry these figures. */}
        {(disks.length === 1 || h >= 3) && (
          <div className="text-xs text-fg-3 mt-1.5 truncate">
            {formatBytes(used)} used of {formatBytes(total)}
            {disks.length > 1 && ` across ${disks.length} disks`}
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

export function NetworkWidget({ h }) {
  const { data, error, history } = useMetrics();
  if (!data) return error ? <Offline /> : <Loading />;
  const net = data.network;
  if (!net) {
    return <EmptyState icon={Network} title="Network stats unavailable" hint="Supported on Linux and Windows hosts." />;
  }

  const samples = history.filter((p) => p.data.network && !p.data.network.warmup);
  const series = [
    { key: "rx", label: "Download", color: "var(--series-1)", values: samples.map((p) => p.data.network.rxRate) },
    { key: "tx", label: "Upload", color: "var(--series-2)", values: samples.map((p) => p.data.network.txRate) },
  ];

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      {h > 1 && <WidgetHeader icon={Network} title="Network" />}
      <div className="grid grid-cols-2 gap-3">
        <RateStat icon={ArrowDown} label="Down" value={net.rxRate} color="var(--series-1)" />
        <RateStat icon={ArrowUp} label="Up" value={net.txRate} color="var(--series-2)" />
      </div>
      {h > 1 && (
        <div className="flex-1 min-h-0 mt-1">
          <LineChart series={series} times={samples.map((p) => p.t)} format={formatRate} />
        </div>
      )}
    </div>
  );
}

export function SystemWidget({ w, h }) {
  const { data, error } = useMetrics();
  if (!data) return error ? <Offline /> : <Loading />;
  const { cpu, memory, disks } = data;
  const memPct = (memory.used / memory.total) * 100;
  const disk = disks?.[0];
  const diskPct = disk ? (disk.used / disk.total) * 100 : null;
  const ringSize = h === 1 ? 44 : Math.min(84, 26 + h * 18);

  const rings = [
    { label: "CPU", value: cpu.usage },
    { label: "RAM", value: memPct },
    ...(diskPct != null ? [{ label: "Disk", value: diskPct }] : []),
  ];

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <WidgetHeader icon={Server} title="System" />
          <div className="text-lg font-semibold mt-1 truncate">{data.hostname}</div>
          <div className="text-xs text-fg-3 truncate">
            {PLATFORM[data.platform] ?? data.platform} · up {formatDuration(data.uptime)}
          </div>
        </div>
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
      {h >= 3 && <div className="text-xs text-fg-3 truncate">{cpu.model}</div>}
    </div>
  );
}
