"use client";

import { Droplets, MapPin, Thermometer, Wind, CloudOff } from "lucide-react";
import { useDash, useNow, useWeather } from "../DashContext";
import { useElementSize } from "../charts";
import { describeWeather } from "@/lib/weatherCodes";
import { EmptyState, SetupButton } from "./common";

const deg = (v) => (v == null ? "—" : `${Math.round(v)}°`);

function hourLabel(time) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric" }).replace(/\s/g, "").toLowerCase();
}

function dayLabel(date, i) {
  if (i === 0) return "Today";
  return new Date(`${date}T12:00`).toLocaleDateString([], { weekday: "short" });
}

// Hours that have finished drop off on the hour, without waiting for a fetch.
function HourlyStrip({ hourly }) {
  const [ref, { width }] = useElementSize();
  const now = useNow(30000);
  const count = Math.max(1, Math.floor(width / 54));
  const upcoming = hourly.filter((hr) => hr.at == null || hr.at + 3600000 > now);
  return (
    <div ref={ref} className="flex justify-between gap-1 min-w-0">
      {width > 0 &&
        upcoming.slice(0, count).map((hr, i) => {
          const { Icon, color, label } = describeWeather(hr.code, hr.isDay);
          return (
            <div key={hr.time} className="flex flex-col items-center gap-1 min-w-[44px]" title={label}>
              <span className="text-[11px] text-fg-3">{i === 0 ? "Now" : hourLabel(hr.time)}</span>
              <Icon size={18} style={{ color }} />
              <span className="text-sm font-medium">{deg(hr.temp)}</span>
            </div>
          );
        })}
    </div>
  );
}

function DailyList({ daily }) {
  const [ref, { height }] = useElementSize();
  const rows = Math.max(0, Math.floor(height / 30));
  const lo = Math.min(...daily.map((d) => d.min));
  const hi = Math.max(...daily.map((d) => d.max));
  const span = hi - lo || 1;

  return (
    <div ref={ref} className="flex-1 min-h-0 flex flex-col justify-start">
      {daily.slice(0, rows).map((d, i) => {
        const { Icon, color, label } = describeWeather(d.code, true);
        return (
          <div
            key={d.date}
            className="h-[30px] grid grid-cols-[3.2rem_1.5rem_2.6rem_2.2rem_1fr_2.2rem] items-center gap-2 text-sm"
          >
            <span className="text-fg-2">{dayLabel(d.date, i)}</span>
            <Icon size={16} style={{ color }} aria-label={label} />
            <span className="text-[11px] text-fg-3 tabular-nums">{d.pop ? `${d.pop}%` : ""}</span>
            <span className="text-fg-3 text-right tabular-nums">{deg(d.min)}</span>
            <div className="h-1.5 rounded-full bg-accent/15 relative">
              <div
                className="absolute inset-y-0 rounded-full bg-accent"
                style={{ left: `${((d.min - lo) / span) * 100}%`, right: `${100 - ((d.max - lo) / span) * 100}%` }}
              />
            </div>
            <span className="font-medium tabular-nums">{deg(d.max)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WeatherWidget({ w, h }) {
  const { settings } = useDash();
  const { data, error, loading } = useWeather();
  const place = settings.weather.location?.name;
  const windUnit = settings.weather.units === "metric" ? "km/h" : "mph";

  if (error === "no-location") {
    return (
      <EmptyState
        icon={MapPin}
        title="Where are you?"
        hint="Pick a location to see local weather."
        action={<SetupButton tab="general">Set location</SetupButton>}
      />
    );
  }
  if (error && !data) {
    return <EmptyState icon={CloudOff} title="Weather unavailable" hint="Couldn't reach the forecast service." />;
  }
  if (loading || !data) {
    return <div className="h-full animate-pulse" />;
  }

  const { current, hourly, daily } = data;
  const now = describeWeather(current.code, current.isDay);
  const today = daily[0];

  if (h === 1 || w <= 2) {
    return (
      <div className="h-full flex items-center gap-3 px-4">
        <now.Icon size={34} style={{ color: now.color }} className="shrink-0" />
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{deg(current.temp)}</div>
          <div className="text-xs text-fg-2 truncate mt-1">{now.label}</div>
        </div>
        {w > 2 && (
          <div className="ml-auto text-right text-xs text-fg-3">
            <div>H {deg(today.max)}</div>
            <div>L {deg(today.min)}</div>
          </div>
        )}
      </div>
    );
  }

  const showDaily = h >= 3 && w >= 4;

  return (
    <div className="h-full flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[13px] text-fg-2 truncate">
            <MapPin size={12} className="shrink-0 text-fg-3" />
            <span className="truncate">{place ?? "Local weather"}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span
              className="font-semibold tracking-tight leading-none"
              style={{ fontSize: "clamp(34px, 22cqh, 64px)" }}
            >
              {deg(current.temp)}
            </span>
            <now.Icon size={40} style={{ color: now.color }} />
          </div>
          <div className="text-sm text-fg-2 mt-1.5">
            {now.label} · H {deg(today.max)} L {deg(today.min)}
          </div>
        </div>
        {w >= 4 && (
          <div className="grid gap-1.5 text-xs text-fg-2 pt-1 shrink-0">
            <span className="flex items-center gap-1.5">
              <Thermometer size={13} className="text-fg-3" /> Feels {deg(current.feelsLike)}
            </span>
            <span className="flex items-center gap-1.5">
              <Droplets size={13} className="text-fg-3" /> {current.humidity}%
            </span>
            <span className="flex items-center gap-1.5">
              <Wind size={13} className="text-fg-3" /> {Math.round(current.wind)} {windUnit}
            </span>
          </div>
        )}
      </div>
      <div className="mt-auto pt-3 border-t border-line">
        <HourlyStrip hourly={hourly} />
      </div>
      {showDaily && (
        <div className="flex-1 min-h-0 flex flex-col border-t border-line pt-2">
          <DailyList daily={daily} />
        </div>
      )}
    </div>
  );
}
