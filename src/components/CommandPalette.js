"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Globe, LayoutDashboard, Search } from "lucide-react";
import ServiceIcon from "./ServiceIcon";
import { SEARCH_ENGINES } from "@/lib/store";
import { looksLikeUrl, openUrl, searchUrl } from "./widgets/tools";
import { hostOf } from "@/lib/format";
import { cx } from "./ui";

export default function CommandPalette({ open, onClose, services, actions, boards, onBoard, settings }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);
  const newTab = settings.general.openInNewTab;
  const engine = SEARCH_ENGINES[settings.general.searchEngine] ?? SEARCH_ENGINES.google;

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (s) => !term || s.toLowerCase().includes(term);
    const out = [];
    services
      .filter((s) => match(s.name) || match(s.description) || match(hostOf(s.url)))
      .forEach((s) =>
        out.push({
          id: `s:${s.id}`,
          group: "Services",
          label: s.name,
          hint: hostOf(s.url),
          service: s,
          run: () => openUrl(s.url, newTab),
        }),
      );
    if (boards.length > 1) {
      boards
        .filter((b) => match(b.name))
        .forEach((b) =>
          out.push({
            id: `b:${b.id}`,
            group: "Boards",
            label: b.name,
            icon: LayoutDashboard,
            run: () => onBoard(b.id),
          }),
        );
    }
    actions.filter((a) => match(a.label)).forEach((a) => out.push({ ...a, group: "Actions" }));
    if (term) {
      const raw = q.trim();
      out.push(
        looksLikeUrl(raw)
          ? {
              id: "url",
              group: "Web",
              label: `Open ${raw}`,
              icon: Globe,
              run: () => openUrl(/^https?:/i.test(raw) ? raw : `https://${raw}`, newTab),
            }
          : {
              id: "web",
              group: "Web",
              label: `Search ${engine.name} for “${raw}”`,
              icon: Search,
              run: () => openUrl(searchUrl(settings.general.searchEngine, raw), newTab),
            },
      );
    }
    return out;
  }, [q, services, boards, actions, newTab, engine, onBoard, settings.general.searchEngine]);

  useEffect(() => setIndex(0), [q]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const run = (item) => {
    onClose();
    item?.run();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(items[index]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm fade-in" onClick={onClose} />
      <div
        className="panel pop-in relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search size={18} className="text-fg-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search services, actions, or the web…"
            className="flex-1 h-14 bg-transparent outline-none text-[15px] placeholder:text-fg-3"
          />
          <span className="kbd">Esc</span>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="text-sm text-fg-3 text-center py-8">Nothing found.</p>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {header && (
                  <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  data-index={i}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(item)}
                  className={cx(
                    "w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                    i === index && "bg-accent/15",
                  )}
                >
                  {item.service ? (
                    <ServiceIcon src={item.service.icon} name={item.service.name} size={24} />
                  ) : (
                    <span className="size-6 grid place-items-center text-fg-2">{Icon && <Icon size={16} />}</span>
                  )}
                  <span className="text-sm flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-fg-3 truncate max-w-[40%]">{item.hint}</span>}
                  {i === index && <CornerDownLeft size={14} className="text-fg-3 shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
