"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/**
 * Thin line chart for tiles. One y-scale shared by every series (same unit),
 * 2px lines, ~10% area wash for a single series, ringed end dots, and a
 * crosshair + tooltip on hover.
 */
export function LineChart({ series, times = [], max, min = 0, format = (v) => v, nullLabel = "—", className = "" }) {
  const [ref, { width, height }] = useElementSize();
  const [hover, setHover] = useState(null);

  const n = Math.max(0, ...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  const top = max ?? Math.max(1, ...all) * 1.15;
  const padTop = 6;
  const padBottom = 3;
  const plotH = Math.max(1, height - padTop - padBottom);

  const x = (i) => (n <= 1 ? width : (i / (n - 1)) * (width - 6));
  const y = (v) => padTop + plotH - ((Math.min(v, top) - min) / (top - min || 1)) * plotH;

  // Missing values (null) break the line into separate runs instead of
  // dropping to zero, so an outage or a gap in the data never reads as a dip.
  const runsOf = (values) => {
    const runs = [];
    let run = [];
    values.forEach((v, i) => {
      if (v == null) {
        if (run.length) runs.push(run);
        run = [];
      } else run.push(i);
    });
    if (run.length) runs.push(run);
    return runs;
  };
  const linePath = (values, run) =>
    run.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join("");
  const areaPath = (values, run) => `${linePath(values, run)}L${x(run.at(-1))},${height}L${x(run[0])},${height}Z`;
  const lastIndex = (values) => values.findLastIndex((v) => v != null);

  const onMove = (e) => {
    if (n < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.round(((e.clientX - rect.left) / (width - 6)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const hx = hover != null ? x(hover) : 0;
  const tipLeft = hx > width / 2;

  return (
    <div ref={ref} className={`relative w-full h-full min-h-0 ${className}`}>
      {width > 0 && height > 0 && (
        <svg
          width={width}
          height={height}
          className="block overflow-visible"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--hairline)" />
          {n >= 2 &&
            series.map((s) => {
              const runs = runsOf(s.values);
              const last = lastIndex(s.values);
              return (
                <g key={s.key}>
                  {series.length === 1 &&
                    runs.map((run) => (
                      <path key={`a${run[0]}`} d={areaPath(s.values, run)} fill={s.color} opacity={0.12} />
                    ))}
                  {runs.map((run) =>
                    run.length === 1 ? (
                      <circle key={`p${run[0]}`} cx={x(run[0])} cy={y(s.values[run[0]])} r={1.5} fill={s.color} />
                    ) : (
                      <path
                        key={`l${run[0]}`}
                        d={linePath(s.values, run)}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ),
                  )}
                  {hover == null && last >= 0 && (
                    <circle
                      cx={x(last)}
                      cy={y(s.values[last])}
                      r={4}
                      fill={s.color}
                      stroke="var(--panel-solid)"
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}
          {hover != null && (
            <g>
              <line x1={hx} x2={hx} y1={0} y2={height} stroke="var(--text-3)" strokeWidth={1} />
              {series.map((s) =>
                s.values[hover] != null ? (
                  <circle
                    key={s.key}
                    cx={hx}
                    cy={y(s.values[hover])}
                    r={4}
                    fill={s.color}
                    stroke="var(--panel-solid)"
                    strokeWidth={2}
                  />
                ) : null,
              )}
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg panel px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={tipLeft ? { right: width - hx + 8 } : { left: hx + 8 }}
        >
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              <span className="font-semibold text-fg">
                {s.values[hover] == null ? nullLabel : format(s.values[hover])}
              </span>
              {series.length > 1 && <span className="text-fg-3">{s.label}</span>}
            </div>
          ))}
          {times[hover] && (
            <div className="text-fg-3 mt-0.5 tabular-nums">
              {new Date(times[hover]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Meter({ value, color, height = 6 }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function Ring({ value, color, size = 64, stroke = 6, children }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`color-mix(in srgb, ${color} 18%, transparent)`}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
