export function formatBytes(bytes, digits = 1) {
  if (bytes == null || isNaN(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = Math.abs(bytes);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : digits)} ${units[i]}`;
}

export function formatRate(bytesPerSec) {
  if (bytesPerSec == null) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatPercent(value, digits = 0) {
  if (value == null || isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTime(date, { hour12 = true, seconds = false } = {}) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12,
  });
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Severity used by meters: the fill carries the state, the track stays neutral.
export function severityColor(pct) {
  if (pct >= 90) return "var(--bad)";
  if (pct >= 75) return "var(--warn)";
  return "var(--accent)";
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
