"use client";

import { Settings2 } from "lucide-react";
import { useDash } from "../DashContext";

export function WidgetHeader({ icon: Icon, title, right }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg-2 min-w-0">
        {Icon && <Icon size={14} className="shrink-0 text-fg-3" />}
        <span className="truncate">{title}</span>
      </div>
      {right && <div className="flex items-center gap-2 text-xs text-fg-3 shrink-0">{right}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 p-4">
      {Icon && <Icon size={22} className="text-fg-3 mb-1" />}
      <div className="text-sm font-medium text-fg">{title}</div>
      {hint && <div className="text-xs text-fg-3 max-w-[28ch]">{hint}</div>}
      {action}
    </div>
  );
}

export function SetupButton({ tab, children }) {
  const { openSettings } = useDash();
  return (
    <button
      type="button"
      onClick={() => openSettings(tab)}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-medium text-fg hover:bg-accent/25 transition"
    >
      <Settings2 size={12} />
      {children}
    </button>
  );
}

// Status dot paired with a text label so state never relies on color alone.
export function StatusDot({ state, pulse }) {
  const color = state === "up" ? "var(--good)" : state === "down" ? "var(--bad)" : "var(--text-3)";
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${pulse && state === "up" ? "pulse-dot" : ""}`}
      style={{ background: color, color }}
    />
  );
}

export function serviceState(result) {
  if (!result) return "unknown";
  return result.up ? "up" : "down";
}
