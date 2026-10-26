import { uid } from "./format";

export const STORAGE_KEY = "homedash:v2";
export const BG_UPLOAD_KEY = "homedash:v2:bg";

export const ACCENTS = [
  { name: "Periwinkle", value: "#7c8cff" },
  { name: "Sky", value: "#38bdf8" },
  { name: "Teal", value: "#2dd4bf" },
  { name: "Lime", value: "#84cc16" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Coral", value: "#fb7185" },
  { name: "Orchid", value: "#c084fc" },
  { name: "Silver", value: "#a1a1aa" },
];

export const BACKGROUNDS = [
  { id: "forest", name: "Forest", css: "url('/forest.jpg') center / cover no-repeat, #0d1410" },
  {
    id: "aurora",
    name: "Aurora",
    animated: true,
    css: "radial-gradient(60% 50% at 20% 20%, #1d4ed8 0%, transparent 60%), radial-gradient(50% 50% at 80% 30%, #7c3aed 0%, transparent 60%), radial-gradient(60% 60% at 50% 90%, #059669 0%, transparent 60%), #05070f",
  },
  {
    id: "midnight",
    name: "Midnight",
    css: "radial-gradient(1200px 600px at 10% -10%, #2b3a8c 0%, transparent 60%), radial-gradient(900px 600px at 110% 10%, #5b2a86 0%, transparent 55%), linear-gradient(180deg, #0b0e1a, #06070d)",
  },
  {
    id: "sunset",
    name: "Sunset",
    css: "radial-gradient(900px 500px at 85% 0%, #ffb36b 0%, transparent 60%), linear-gradient(160deg, #ff7e5f 0%, #b24592 45%, #2b1055 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    css: "radial-gradient(1000px 700px at 80% 0%, #0ea5e9 0%, transparent 60%), radial-gradient(800px 600px at 0% 100%, #14b8a6 0%, transparent 55%), linear-gradient(180deg, #083344, #020617)",
  },
  {
    id: "nebula",
    name: "Nebula",
    css: "radial-gradient(700px 500px at 15% 25%, #f472b6 0%, transparent 60%), radial-gradient(800px 600px at 85% 20%, #818cf8 0%, transparent 60%), radial-gradient(900px 600px at 50% 110%, #22d3ee 0%, transparent 60%), #1e1b4b",
  },
  {
    id: "graphite",
    name: "Graphite",
    css: "radial-gradient(1200px 700px at 50% -20%, #33363f 0%, transparent 70%), linear-gradient(180deg, #17181c, #0c0d10)",
  },
  {
    id: "dawn",
    name: "Dawn",
    css: "radial-gradient(900px 600px at 0% 0%, #fde68a 0%, transparent 55%), radial-gradient(900px 700px at 100% 20%, #fbcfe8 0%, transparent 55%), radial-gradient(900px 700px at 50% 120%, #bfdbfe 0%, transparent 60%), #f8fafc",
  },
];

export const SEARCH_ENGINES = {
  google: { name: "Google", url: "https://www.google.com/search?q=%s" },
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
  bing: { name: "Bing", url: "https://www.bing.com/search?q=%s" },
  brave: { name: "Brave", url: "https://search.brave.com/search?q=%s" },
  kagi: { name: "Kagi", url: "https://kagi.com/search?q=%s" },
};

export const DEFAULT_SETTINGS = {
  general: {
    title: "Welcome Home",
    showHeader: true,
    openInNewTab: true,
    searchEngine: "google",
    systemInterval: 3,
    proxmoxInterval: 5,
    weatherInterval: 300,
  },
  clock: { hour12: true, showSeconds: false },
  weather: { location: null, units: "imperial" },
  // tracks: [{ id: file name in the sounds library, volume: 0-100 }]
  sounds: { tracks: [], schedules: [] },
  appearance: {
    theme: "dark",
    accent: "#7c8cff",
    background: { kind: "preset", preset: "forest", color: "#111827", url: "" },
    bgDim: 25,
    bgBlur: 0,
    tileOpacity: 55,
    tileBlur: 18,
    radius: 18,
    tileBorders: true,
    reduceMotion: false,
  },
  layout: { columns: 12, rowHeight: 96, gap: 14, maxWidth: 1440 },
};

const GROUP_ORDER = { public: 0, private: 1, infrastructure: 2 };

export function tile(type, w, h, config = {}) {
  return { id: uid(), type, w, h, config };
}

export function defaultTiles(services) {
  const ordered = [...services].sort(
    (a, b) => (GROUP_ORDER[a.group] ?? 1) - (GROUP_ORDER[b.group] ?? 1) || a.name.localeCompare(b.name),
  );
  return [
    tile("clock", 4, 2),
    tile("weather", 5, 2),
    tile("status", 3, 2),
    tile("cpu", 3, 2),
    tile("memory", 3, 2),
    tile("network", 3, 2),
    tile("storage", 3, 2),
    ...ordered.map((s) => tile("service", 3, 1, { serviceId: s.id })),
  ];
}

export function defaultState(services) {
  const id = uid();
  return {
    version: 2,
    settings: structuredClone(DEFAULT_SETTINGS),
    boards: [{ id, name: "Home", tiles: defaultTiles(services) }],
    activeBoard: id,
    knownServices: services.map((s) => s.id),
  };
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge(base, patch) {
  if (!isObject(patch)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObject(v) && isObject(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

// Normalizes anything loaded from storage or an import file.
export function hydrate(raw, services) {
  const fallback = defaultState(services);
  if (!isObject(raw) || !Array.isArray(raw.boards) || raw.boards.length === 0) return fallback;

  const state = {
    version: 2,
    settings: deepMerge(DEFAULT_SETTINGS, raw.settings),
    boards: raw.boards.map((b) => ({
      id: b.id ?? uid(),
      name: b.name ?? "Board",
      tiles: (b.tiles ?? []).filter((t) => t && t.type).map((t) => ({ config: {}, ...t, id: t.id ?? uid() })),
    })),
    activeBoard: raw.activeBoard,
    knownServices: Array.isArray(raw.knownServices) ? raw.knownServices : [],
  };
  if (!state.boards.some((b) => b.id === state.activeBoard)) state.activeBoard = state.boards[0].id;

  // Services added to services.json since the last visit land on the first board.
  if (services.length) {
    const known = new Set(state.knownServices);
    const fresh = services.filter((s) => !known.has(s.id));
    if (fresh.length) {
      state.boards[0].tiles = [
        ...state.boards[0].tiles,
        ...fresh.map((s) => tile("service", 3, 1, { serviceId: s.id })),
      ];
      state.knownServices = [...state.knownServices, ...fresh.map((s) => s.id)];
    }
  }
  return state;
}

export function loadState(services) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return hydrate(raw, services);
  } catch {
    return defaultState(services);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadUpload() {
  try {
    return localStorage.getItem(BG_UPLOAD_KEY);
  } catch {
    return null;
  }
}

export function saveUpload(dataUrl) {
  if (dataUrl) localStorage.setItem(BG_UPLOAD_KEY, dataUrl);
  else localStorage.removeItem(BG_UPLOAD_KEY);
}
