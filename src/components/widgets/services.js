"use client";

import { Activity, AlertTriangle, CheckCircle2, Link2, Lock, SearchX } from "lucide-react";
import { useDash, useStatus } from "../DashContext";
import { LineChart } from "../charts";
import ServiceIcon from "../ServiceIcon";
import { hostOf } from "@/lib/format";
import { EmptyState, StatusDot, WidgetHeader, serviceState } from "./common";

export const GROUPS = [
  { value: "all", label: "All services" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
  { value: "infrastructure", label: "Infrastructure" },
];

function filterGroup(services, group) {
  return !group || group === "all" ? services : services.filter((s) => s.group === group);
}

function useLinkProps(url) {
  const { settings, editMode } = useDash();
  return {
    href: url,
    ...(settings.general.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    tabIndex: editMode ? -1 : undefined,
    draggable: false,
  };
}

function StatusLabel({ result }) {
  const state = serviceState(result);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-fg-3 tabular-nums whitespace-nowrap"
      title={state === "down" ? `Down: ${result.error ?? "no response"}` : undefined}
    >
      <StatusDot state={state} pulse />
      {state === "up" ? `${result.latency} ms` : state === "down" ? "Down" : "Checking"}
    </span>
  );
}

function LinkTile({ name, url, icon, description, isPrivate, result, w, h, history }) {
  const linkProps = useLinkProps(url);
  const state = serviceState(result);

  if (w === 1) {
    return (
      <a
        {...linkProps}
        className="h-full flex flex-col items-center justify-center gap-2 p-2 relative"
        title={`${name} — ${state}`}
      >
        {result !== undefined && (
          <span className="absolute top-2.5 right-2.5">
            <StatusDot state={state} />
          </span>
        )}
        <ServiceIcon src={icon} name={name} size={h > 1 ? 52 : 34} />
        <span className="text-xs font-medium text-center leading-tight line-clamp-2">{name}</span>
      </a>
    );
  }

  const big = h >= 2;
  return (
    <a {...linkProps} className={`h-full flex ${big ? "flex-col p-4 gap-3" : "items-center gap-3.5 px-4"}`}>
      <div className={big ? "flex items-start justify-between" : "contents"}>
        <ServiceIcon src={icon} name={name} size={big ? 48 : 40} />
        {big && result !== undefined && <StatusLabel result={result} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{name}</span>
          {isPrivate && <Lock size={11} className="shrink-0 text-fg-3" aria-label="Private" />}
        </div>
        {description && (
          <p className={`text-[13px] text-fg-2 mt-0.5 ${big ? "line-clamp-3" : w >= 3 ? "truncate" : "hidden"}`}>
            {description}
          </p>
        )}
        {!big && result !== undefined && w >= 3 && (
          <div className="mt-1">
            <StatusLabel result={result} />
          </div>
        )}
      </div>
      {big && h >= 3 && history?.length > 1 && (
        <div className="h-12 shrink-0">
          <LineChart
            series={[
              { key: "lat", label: "Latency", color: "var(--accent)", values: history.map((r) => r?.latency ?? null) },
            ]}
            format={(v) => `${v} ms`}
            nullLabel="Down"
          />
        </div>
      )}
      {big && <div className="text-[11px] text-fg-3 truncate mt-auto">{hostOf(url)}</div>}
    </a>
  );
}

export function ServiceWidget({ w, h, config }) {
  const { servicesById } = useDash();
  const { data, history } = useStatus();
  const service = servicesById[config.serviceId];

  if (!service) {
    return <EmptyState icon={SearchX} title="Service not found" hint="It may have been removed from services.json." />;
  }

  return (
    <LinkTile
      name={service.name}
      url={service.url}
      icon={service.icon}
      description={service.description}
      isPrivate={service.private}
      result={data ? (data.services[service.id] ?? null) : undefined}
      history={history.map((p) => p.data.services[service.id])}
      w={w}
      h={h}
    />
  );
}

export function LinkWidget({ w, h, config }) {
  if (!config.url) {
    return <EmptyState icon={Link2} title="Custom link" hint="Open the tile settings to add a URL." />;
  }
  let icon = config.icon;
  if (!icon) {
    try {
      icon = `${new URL(config.url).origin}/favicon.ico`;
    } catch {}
  }
  return (
    <LinkTile
      name={config.name || hostOf(config.url)}
      url={config.url}
      icon={icon}
      description={config.description}
      w={w}
      h={h}
    />
  );
}

export function ServicesWidget({ w, config }) {
  const { services } = useDash();
  const { data } = useStatus();
  const list = filterGroup(services, config.group);
  const title = config.title || GROUPS.find((g) => g.value === config.group)?.label || "Services";
  const cols = Math.max(1, Math.floor(w / 3));

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <WidgetHeader icon={Link2} title={title} right={`${list.length}`} />
      <div
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar grid content-start gap-1 -mx-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {list.map((s) => (
          <ServiceRow key={s.id} service={s} result={data?.services[s.id]} />
        ))}
      </div>
    </div>
  );
}

function ServiceRow({ service, result }) {
  const linkProps = useLinkProps(service.url);
  return (
    <a
      {...linkProps}
      className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-[var(--hover)] transition min-w-0"
      title={service.description}
    >
      <ServiceIcon src={service.icon} name={service.name} size={26} />
      <span className="text-sm truncate flex-1">{service.name}</span>
      <StatusDot state={serviceState(result)} />
    </a>
  );
}

export function StatusWidget({ w, h, config }) {
  const { services } = useDash();
  const { data, history, error } = useStatus();
  const list = filterGroup(services, config.group);

  if (!services.length) return <EmptyState icon={Activity} title="No services" hint="Add services to services.json." />;
  if (!data) {
    return error ? (
      <EmptyState icon={Activity} title="Health checks failed" hint={error} />
    ) : (
      <div className="h-full flex flex-col p-4 gap-2">
        <WidgetHeader icon={Activity} title="Service health" />
        <div className="text-sm text-fg-3 mt-2">Checking {list.length} services…</div>
      </div>
    );
  }

  const results = list.map((s) => ({ service: s, result: data.services[s.id] }));
  const up = results.filter((r) => r.result?.up);
  const down = results.filter((r) => r.result && !r.result.up);
  const avg = up.length ? Math.round(up.reduce((a, r) => a + r.result.latency, 0) / up.length) : null;
  const sorted = [...down, ...up].concat(results.filter((r) => !r.result));
  const showBars = w >= 5;

  const summary = down.length ? (
    <span className="flex items-center gap-1.5">
      <AlertTriangle size={13} style={{ color: "var(--bad)" }} />
      {down.length} {down.length === 1 ? "service" : "services"} down
    </span>
  ) : (
    <span className="flex items-center gap-1.5">
      <CheckCircle2 size={13} style={{ color: "var(--good)" }} />
      All systems operational
    </span>
  );

  if (h === 1) {
    return (
      <div className="h-full flex items-center justify-between gap-3 px-4">
        <div>
          <div className="text-2xl font-semibold leading-none">
            {up.length}
            <span className="text-fg-3 text-base">/{list.length}</span>
          </div>
          <div className="text-xs text-fg-3 mt-1">online</div>
        </div>
        <div className="text-xs text-fg-2 text-right">{summary}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <WidgetHeader icon={Activity} title="Service health" right={avg != null && `avg ${avg} ms`} />
      <div>
        <div className="font-semibold tracking-tight leading-none" style={{ fontSize: "clamp(26px, 15cqh, 48px)" }}>
          {up.length}
          <span className="text-fg-3 text-[0.55em] font-medium"> / {list.length} online</span>
        </div>
        <div className="text-xs text-fg-2 mt-2">{summary}</div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar fade-bottom -mx-1 border-t border-line pt-2 pb-3">
        {sorted.map(({ service, result }) => (
          <div key={service.id} className="flex items-center gap-2.5 px-1 py-1 text-sm">
            <ServiceIcon src={service.icon} name={service.name} size={18} />
            <span className="truncate flex-1 min-w-0 text-fg-2">{service.name}</span>
            {showBars && <HistoryBars samples={history.map((p) => p.data.services[service.id])} />}
            <span className="w-[4.5rem] flex justify-end">
              <StatusLabel result={result} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tiny status-page style history: one bar per check, newest on the right.
function HistoryBars({ samples }) {
  const slots = 20;
  const padded = [...Array(Math.max(0, slots - samples.length)).fill(null), ...samples.slice(-slots)];
  return (
    <div className="flex items-center gap-[2px] h-4 shrink-0" aria-hidden>
      {padded.map((s, i) => (
        <span
          key={i}
          className="w-[3px] h-full rounded-[1px]"
          style={{
            background: s == null ? "var(--track)" : s.up ? "var(--good)" : "var(--bad)",
            opacity: s == null ? 1 : 0.85,
          }}
        />
      ))}
    </div>
  );
}
