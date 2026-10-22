"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDash, useNow } from "../DashContext";
import { greeting } from "@/lib/format";
import { cx } from "../ui";

function safeZone(tz) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat([], { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export function ClockWidget({ h, config }) {
  const { settings } = useDash();
  const { hour12, showSeconds } = settings.clock;
  const now = useNow(1000);
  const timeZone = safeZone(config.timezone);

  const parts = new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
    hour12,
    timeZone,
  }).formatToParts(now);
  const time = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  const period = parts.find((p) => p.type === "dayPeriod")?.value;

  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", timeZone });
  const label = config.label || (timeZone ? timeZone.split("/").pop().replace(/_/g, " ") : greeting(now));

  if (h === 1) {
    return (
      <div className="h-full flex items-center justify-between gap-3 px-5">
        <div className="font-semibold tracking-tight leading-none" style={{ fontSize: "min(52cqh, 14cqw)" }}>
          {time}
          {period && <span className="ml-1.5 text-fg-3 text-[0.42em] font-medium">{period}</span>}
        </div>
        <div className="text-right min-w-0">
          <div className="text-sm text-fg truncate">{label}</div>
          <div className="text-xs text-fg-3 truncate">{date}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-between p-5">
      <div className="text-sm font-medium text-fg-2 truncate">{label}</div>
      <div>
        <div
          className="font-semibold tracking-[-0.03em] leading-[0.95]"
          style={{ fontSize: "clamp(28px, min(36cqh, 19cqw), 140px)" }}
        >
          {time}
          {period && <span className="ml-2 text-fg-3 text-[0.32em] font-medium tracking-normal">{period}</span>}
        </div>
        <div className="mt-2 text-fg-2" style={{ fontSize: "clamp(13px, 9cqh, 20px)" }}>
          {date}
        </div>
      </div>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWidget({ config }) {
  const now = useNow(60000);
  const [offset, setOffset] = useState(0);
  const weekStart = config.weekStart === "mon" ? 1 : 0;

  const { title, days, month } = useMemo(() => {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const start = new Date(first);
    start.setDate(1 - lead);
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    return {
      title: first.toLocaleDateString([], { month: "long", year: "numeric" }),
      days,
      month: first.getMonth(),
    };
  }, [now, offset, weekStart]);

  const isToday = (d) => d.toDateString() === now.toDateString();
  const labels = [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)];

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset(0)}
          className="text-sm font-semibold hover:text-accent transition"
          title="Back to today"
        >
          {title}
        </button>
        <div className="flex">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setOffset((o) => o - 1)}
            className="size-7 grid place-items-center rounded-lg text-fg-2 hover:bg-[var(--hover)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setOffset((o) => o + 1)}
            className="size-7 grid place-items-center rounded-lg text-fg-2 hover:bg-[var(--hover)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-fg-3">
        {labels.map((d) => (
          <div key={d}>{d.slice(0, 2)}</div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 text-center"
        style={{ fontSize: "clamp(11px, 4.2cqh, 15px)" }}
      >
        {days.map((d) => (
          <div key={d.toISOString()} className="grid place-items-center">
            <span
              className={cx(
                "grid place-items-center rounded-full tabular-nums",
                d.getMonth() !== month && "text-fg-3/60",
                isToday(d) && "bg-accent text-[var(--accent-fg)] font-semibold",
              )}
              style={{ width: "2.1em", height: "2.1em" }}
            >
              {d.getDate()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
