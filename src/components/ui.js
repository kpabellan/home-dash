"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function IconButton({ label, active, className, children, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "inline-flex size-9 items-center justify-center rounded-xl text-fg-2 transition",
        "hover:bg-[var(--hover)] hover:text-fg focus-visible:outline-2 focus-visible:outline-accent",
        active && "bg-accent/15 text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Button({ variant = "default", className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 h-9 text-sm font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40",
        variant === "primary" && "bg-accent text-[var(--accent-fg)] hover:brightness-110",
        variant === "default" && "bg-[var(--input)] text-fg hover:bg-[var(--hover)] border border-line",
        variant === "ghost" && "text-fg-2 hover:text-fg hover:bg-[var(--hover)]",
        variant === "danger" && "bg-bad/15 text-fg border border-bad/40 hover:bg-bad/25",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-[var(--track)]")}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

export function Segmented({ value, onChange, options, size = "md" }) {
  return (
    <div className="inline-flex rounded-xl bg-[var(--input)] p-1 border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition",
            size === "sm" ? "px-2.5 h-7 text-xs" : "px-3 h-8 text-sm",
            value === o.value ? "bg-[rgb(var(--tile-rgb)/0.9)] text-fg shadow-sm" : "text-fg-2 hover:text-fg",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, onChange, min, max, step = 1, suffix = "" }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <span className="w-14 shrink-0 text-right text-xs text-fg-2 tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function Field({ label, hint, children, inline }) {
  return (
    <div className={cx("block", inline && "flex items-center justify-between gap-4")}>
      <div className={cx(!inline && "mb-2")}>
        <div className="text-sm font-medium text-fg">{label}</div>
        {hint && <div className="text-xs text-fg-3 mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full h-10 rounded-xl bg-[var(--input)] border border-line px-3 text-sm text-fg placeholder:text-fg-3 outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20 transition";

export function Select({ value, onChange, options, className }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputClass, "appearance-none cursor-pointer", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[var(--panel-solid)]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SectionTitle({ children }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3 mb-3">{children}</h3>;
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = "max-w-2xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "panel pop-in relative w-full max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-fg-2 mt-0.5">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
