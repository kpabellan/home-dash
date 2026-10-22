"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  ImagePlus,
  LayoutGrid,
  Link as LinkIcon,
  Loader2,
  LocateFixed,
  MapPin,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { ACCENTS, BACKGROUNDS, SEARCH_ENGINES } from "@/lib/store";
import { Button, Field, IconButton, SectionTitle, Segmented, Select, Slider, Toggle, cx, inputClass } from "./ui";

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "data", label: "Data", icon: Settings2 },
];

export default function SettingsPanel({ open, tab, setTab, onClose, ...props }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20 fade-in" onClick={onClose} />
      <aside
        className="panel slide-in relative h-full w-full sm:w-[420px] sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl flex flex-col shadow-2xl"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Settings</h2>
          <IconButton label="Close settings" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <nav className="px-5 pb-3 flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-sm font-medium whitespace-nowrap transition",
                tab === t.id ? "bg-accent/15 text-fg" : "text-fg-2 hover:text-fg hover:bg-[var(--hover)]",
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8">
          {tab === "appearance" && <AppearanceTab {...props} />}
          {tab === "layout" && <LayoutTab {...props} />}
          {tab === "general" && <GeneralTab {...props} />}
          {tab === "data" && <DataTab {...props} />}
        </div>
      </aside>
    </div>
  );
}

// ---- Appearance ------------------------------------------------------------

function AppearanceTab({ settings, update, upload, onUpload, toast }) {
  const a = settings.appearance;
  const set = (patch) => update("appearance", patch);
  const setBg = (patch) => set({ background: { ...a.background, ...patch } });
  const fileRef = useRef(null);
  const [url, setUrl] = useState(a.background.url);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      onUpload(dataUrl);
      setBg({ kind: "upload" });
    } catch {
      toast("That image couldn't be used — try a smaller file.");
    }
  };

  return (
    <>
      <section>
        <SectionTitle>Theme</SectionTitle>
        <Segmented
          value={a.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: "dark", label: "Dark", icon: <Moon size={14} /> },
            { value: "light", label: "Light", icon: <Sun size={14} /> },
            { value: "auto", label: "Auto", icon: <Monitor size={14} /> },
          ]}
        />
      </section>

      <section>
        <SectionTitle>Accent color</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              aria-label={c.name}
              onClick={() => set({ accent: c.value })}
              className="size-8 rounded-full grid place-items-center ring-offset-2 ring-offset-[var(--panel-solid)] transition hover:scale-110"
              style={{
                background: c.value,
                boxShadow: a.accent === c.value ? `0 0 0 2px var(--panel-solid), 0 0 0 4px ${c.value}` : undefined,
              }}
            >
              {a.accent === c.value && <Check size={14} className="text-black/70" strokeWidth={3} />}
            </button>
          ))}
          <label
            className="size-8 rounded-full border border-dashed border-line grid place-items-center cursor-pointer text-fg-3 hover:text-fg relative overflow-hidden"
            title="Custom color"
            style={
              !ACCENTS.some((c) => c.value === a.accent) ? { background: a.accent, borderStyle: "solid" } : undefined
            }
          >
            <Palette size={14} />
            <input
              type="color"
              value={a.accent}
              onChange={(e) => set({ accent: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </section>

      <section>
        <SectionTitle>Background</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((b) => {
            const active = a.background.kind === "preset" && a.background.preset === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBg({ kind: "preset", preset: b.id })}
                className={cx(
                  "group relative aspect-[4/3] rounded-xl overflow-hidden border transition",
                  active ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-fg-3",
                )}
                style={{ background: b.css }}
                aria-pressed={active}
              >
                <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] font-medium text-white bg-gradient-to-t from-black/60 to-transparent text-left">
                  {b.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <label
            className={cx(
              "relative flex items-center gap-2 rounded-xl border px-2.5 h-10 text-xs font-medium cursor-pointer transition",
              a.background.kind === "solid" ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-fg-3",
            )}
          >
            <span className="size-4 rounded-full border border-line" style={{ background: a.background.color }} />
            Solid
            <input
              type="color"
              value={a.background.color}
              onChange={(e) => setBg({ kind: "solid", color: e.target.value })}
              onClick={() => setBg({ kind: "solid" })}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => (upload ? setBg({ kind: "upload" }) : fileRef.current?.click())}
            className={cx(
              "flex items-center gap-2 rounded-xl border px-2.5 h-10 text-xs font-medium transition",
              a.background.kind === "upload" ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-fg-3",
            )}
          >
            <ImagePlus size={14} />
            {upload ? "My image" : "Upload"}
          </button>
          <button
            type="button"
            onClick={() => setBg({ kind: "url", url })}
            className={cx(
              "flex items-center gap-2 rounded-xl border px-2.5 h-10 text-xs font-medium transition",
              a.background.kind === "url" ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-fg-3",
            )}
          >
            <LinkIcon size={14} />
            Image URL
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {a.background.kind === "upload" && (
          <div className="flex gap-2 mt-2">
            <Button className="flex-1" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Replace image
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onUpload(null);
                setBg({ kind: "preset" });
              }}
            >
              Remove
            </Button>
          </div>
        )}
        {a.background.kind === "url" && (
          <form
            className="flex gap-2 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBg({ url: url.trim() });
            }}
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/wallpaper.jpg"
              className={inputClass}
            />
            <Button type="submit" variant="primary">
              Apply
            </Button>
          </form>
        )}
        <div className="mt-5 space-y-4">
          <Field label="Dim">
            <Slider value={a.bgDim} onChange={(bgDim) => set({ bgDim })} min={0} max={85} suffix="%" />
          </Field>
          <Field label="Blur">
            <Slider value={a.bgBlur} onChange={(bgBlur) => set({ bgBlur })} min={0} max={40} suffix="px" />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Tiles</SectionTitle>
        <div className="space-y-4">
          <Field label="Opacity">
            <Slider
              value={a.tileOpacity}
              onChange={(tileOpacity) => set({ tileOpacity })}
              min={0}
              max={100}
              suffix="%"
            />
          </Field>
          <Field label="Glass blur">
            <Slider value={a.tileBlur} onChange={(tileBlur) => set({ tileBlur })} min={0} max={40} suffix="px" />
          </Field>
          <Field label="Corner radius">
            <Slider value={a.radius} onChange={(radius) => set({ radius })} min={0} max={32} suffix="px" />
          </Field>
          <Field label="Tile borders" inline>
            <Toggle checked={a.tileBorders} onChange={(tileBorders) => set({ tileBorders })} label="Tile borders" />
          </Field>
          <Field label="Reduce motion" hint="Turns off animations and the animated background." inline>
            <Toggle checked={a.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })} label="Reduce motion" />
          </Field>
        </div>
      </section>
    </>
  );
}

function compressImage(file, maxSize = 2400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("bad image"));
    };
    img.src = src;
  });
}

// ---- Layout ----------------------------------------------------------------

function LayoutTab({ settings, update }) {
  const l = settings.layout;
  const set = (patch) => update("layout", patch);
  return (
    <>
      <section>
        <SectionTitle>Grid</SectionTitle>
        <div className="space-y-4">
          <Field label="Columns" hint="Tile widths are measured against this grid.">
            <Slider value={l.columns} onChange={(columns) => set({ columns })} min={4} max={16} />
          </Field>
          <Field label="Row height">
            <Slider
              value={l.rowHeight}
              onChange={(rowHeight) => set({ rowHeight })}
              min={64}
              max={160}
              step={4}
              suffix="px"
            />
          </Field>
          <Field label="Spacing">
            <Slider value={l.gap} onChange={(gap) => set({ gap })} min={4} max={32} suffix="px" />
          </Field>
          <Field label="Max width">
            <Slider
              value={l.maxWidth}
              onChange={(maxWidth) => set({ maxWidth })}
              min={960}
              max={2560}
              step={40}
              suffix="px"
            />
          </Field>
        </div>
      </section>
      <section>
        <SectionTitle>Header</SectionTitle>
        <div className="space-y-4">
          <Field label="Show header" hint="Title, board tabs and quick actions." inline>
            <Toggle
              checked={settings.general.showHeader}
              onChange={(showHeader) => update("general", { showHeader })}
              label="Show header"
            />
          </Field>
          <Field label="Dashboard title">
            <input
              value={settings.general.title}
              onChange={(e) => update("general", { title: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </section>
      <p className="text-xs text-fg-3 leading-relaxed">
        Tip: press <span className="kbd">E</span> to enter edit mode, then drag tiles to rearrange them and pull the
        corner handle to resize.
      </p>
    </>
  );
}

// ---- General ---------------------------------------------------------------

function GeneralTab({ settings, update }) {
  const g = settings.general;
  return (
    <>
      <section>
        <SectionTitle>Weather</SectionTitle>
        <div className="space-y-4">
          <LocationPicker
            location={settings.weather.location}
            onChange={(location) => update("weather", { location })}
          />
          <Field label="Units" inline>
            <Segmented
              size="sm"
              value={settings.weather.units}
              onChange={(units) => update("weather", { units })}
              options={[
                { value: "imperial", label: "°F" },
                { value: "metric", label: "°C" },
              ]}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Clock</SectionTitle>
        <div className="space-y-4">
          <Field label="24-hour time" inline>
            <Toggle
              checked={!settings.clock.hour12}
              onChange={(v) => update("clock", { hour12: !v })}
              label="24-hour time"
            />
          </Field>
          <Field label="Show seconds" inline>
            <Toggle
              checked={settings.clock.showSeconds}
              onChange={(showSeconds) => update("clock", { showSeconds })}
              label="Show seconds"
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Links & search</SectionTitle>
        <div className="space-y-4">
          <Field label="Open links in a new tab" inline>
            <Toggle
              checked={g.openInNewTab}
              onChange={(openInNewTab) => update("general", { openInNewTab })}
              label="Open in new tab"
            />
          </Field>
          <Field label="Default search engine">
            <Select
              value={g.searchEngine}
              onChange={(searchEngine) => update("general", { searchEngine })}
              options={Object.entries(SEARCH_ENGINES).map(([value, e]) => ({ value, label: e.name }))}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Refresh rates</SectionTitle>
        <div className="space-y-4">
          <Field label="Service health checks">
            <Select
              value={String(g.statusInterval)}
              onChange={(v) => update("general", { statusInterval: Number(v) })}
              options={[
                { value: "15", label: "Every 15 seconds" },
                { value: "30", label: "Every 30 seconds" },
                { value: "60", label: "Every minute" },
                { value: "300", label: "Every 5 minutes" },
              ]}
            />
          </Field>
          <Field label="System metrics">
            <Select
              value={String(g.systemInterval)}
              onChange={(v) => update("general", { systemInterval: Number(v) })}
              options={[
                { value: "2", label: "Every 2 seconds" },
                { value: "3", label: "Every 3 seconds" },
                { value: "5", label: "Every 5 seconds" },
                { value: "10", label: "Every 10 seconds" },
              ]}
            />
          </Field>
          <Field label="Proxmox cluster">
            <Select
              value={String(g.proxmoxInterval)}
              onChange={(v) => update("general", { proxmoxInterval: Number(v) })}
              options={[
                { value: "5", label: "Every 5 seconds" },
                { value: "10", label: "Every 10 seconds" },
                { value: "30", label: "Every 30 seconds" },
              ]}
            />
          </Field>
        </div>
      </section>
    </>
  );
}

function LocationPicker({ location, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=6&language=en&format=json`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setErr(null);
      } catch (e) {
        if (e.name !== "AbortError") setErr("Search failed");
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const useMine = () => {
    if (!navigator.geolocation) return setErr("Geolocation isn't available here.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onChange({
          name: "Current location",
          lat: +pos.coords.latitude.toFixed(4),
          lon: +pos.coords.longitude.toFixed(4),
        });
      },
      () => {
        setBusy(false);
        setErr("Location permission was denied (it also needs HTTPS or localhost).");
      },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl bg-[var(--input)] border border-line px-3 py-2.5 mb-2">
        <MapPin size={15} className="text-fg-3 shrink-0" />
        <div className="text-sm flex-1 min-w-0 truncate">
          {location ? location.name : <span className="text-fg-3">Using server default location</span>}
        </div>
        {location && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-fg-3 hover:text-fg">
            Reset
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for a city…"
            className={inputClass}
          />
          {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-3" />}
        </div>
        <IconButton label="Use my location" onClick={useMine} className="size-10 border border-line bg-[var(--input)]">
          <LocateFixed size={16} />
        </IconButton>
      </div>
      {err && <p className="text-xs text-fg-3 mt-2">{err}</p>}
      {results.length > 0 && (
        <ul className="mt-2 rounded-xl border border-line overflow-hidden">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "),
                    lat: r.latitude,
                    lon: r.longitude,
                  });
                  setQ("");
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--hover)] transition"
              >
                {r.name}
                <span className="text-fg-3"> · {[r.admin1, r.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Data ------------------------------------------------------------------

function DataTab({ onExport, onImport, onResetLayout, onResetAll }) {
  const fileRef = useRef(null);
  return (
    <>
      <section>
        <SectionTitle>Backup</SectionTitle>
        <p className="text-sm text-fg-2 mb-3">
          Your layout and settings are saved in this browser. Export them to move to another device.
        </p>
        <div className="flex gap-2">
          <Button onClick={onExport}>
            <Download size={14} /> Export
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>
      <section>
        <SectionTitle>Reset</SectionTitle>
        <div className="space-y-2">
          <Button className="w-full justify-start" onClick={onResetLayout}>
            <RotateCcw size={14} /> Reset this board&apos;s layout
          </Button>
          <Button variant="danger" className="w-full justify-start" onClick={onResetAll}>
            <RotateCcw size={14} /> Reset everything to defaults
          </Button>
        </div>
      </section>
    </>
  );
}
