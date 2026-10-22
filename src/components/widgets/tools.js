"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, StickyNote } from "lucide-react";
import { useDash } from "../DashContext";
import ServiceIcon from "../ServiceIcon";
import { SEARCH_ENGINES } from "@/lib/store";

export function openUrl(url, newTab) {
  if (newTab) window.open(url, "_blank", "noopener,noreferrer");
  else window.location.href = url;
}

export function searchUrl(engineKey, query) {
  const engine = SEARCH_ENGINES[engineKey] ?? SEARCH_ENGINES.google;
  return engine.url.replace("%s", encodeURIComponent(query));
}

export function looksLikeUrl(q) {
  return /^https?:\/\//i.test(q) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q);
}

export function SearchWidget({ h, config }) {
  const { settings, services } = useDash();
  const [q, setQ] = useState("");
  const engineKey = config.engine && config.engine !== "default" ? config.engine : settings.general.searchEngine;
  const engine = SEARCH_ENGINES[engineKey] ?? SEARCH_ENGINES.google;
  const newTab = settings.general.openInNewTab;

  const matches = q.trim()
    ? services.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  const submit = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    if (looksLikeUrl(query)) openUrl(/^https?:/i.test(query) ? query : `https://${query}`, newTab);
    else openUrl(searchUrl(engineKey, query), newTab);
    setQ("");
  };

  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <form onSubmit={submit} className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${engine.name} or type a URL`}
          className="w-full h-12 rounded-2xl bg-[var(--input)] border border-line pl-11 pr-12 text-[15px] text-fg placeholder:text-fg-3 outline-none focus:border-accent/60 focus:ring-4 focus:ring-accent/15 transition"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-xl bg-accent text-[var(--accent-fg)] opacity-90 hover:opacity-100"
        >
          <ArrowRight size={16} />
        </button>
      </form>
      {h > 1 && matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((s) => (
            <a
              key={s.id}
              href={s.url}
              {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--input)] border border-line px-2 py-1 text-xs hover:border-accent/50 transition"
            >
              <ServiceIcon src={s.icon} name={s.name} size={14} />
              {s.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotesWidget({ tile, config }) {
  const { updateTileConfig } = useDash();
  const [text, setText] = useState(config.text ?? "");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (e) => {
    const value = e.target.value;
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => updateTileConfig(tile.id, { text: value }), 400);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg-2">
        <StickyNote size={14} className="text-fg-3" />
        {config.title || "Notes"}
      </div>
      <textarea
        value={text}
        onChange={onChange}
        placeholder="Jot something down…"
        spellCheck={false}
        className="flex-1 min-h-0 w-full resize-none bg-transparent text-sm leading-relaxed text-fg placeholder:text-fg-3 outline-none no-scrollbar"
      />
    </div>
  );
}
