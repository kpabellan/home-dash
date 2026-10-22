"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard, Plus, Search } from "lucide-react";
import { CATEGORIES, WIDGETS } from "./widgets/registry";
import ServiceIcon from "./ServiceIcon";
import { Modal, cx, inputClass } from "./ui";

export default function WidgetLibrary({ open, onClose, onAdd, onAddProxmoxBoard, services, tiles }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const term = q.trim().toLowerCase();

  const onBoard = useMemo(
    () => new Set(tiles.filter((t) => t.type === "service").map((t) => t.config?.serviceId)),
    [tiles],
  );

  const widgets = Object.entries(WIDGETS).filter(
    ([type, w]) =>
      type !== "service" &&
      (cat === "All" || w.category === cat) &&
      (!term || w.name.toLowerCase().includes(term) || w.description.toLowerCase().includes(term)),
  );
  const showBoard =
    (cat === "All" || cat === "Proxmox") && (!term || ["proxmox", "cluster", "board"].some((k) => k.includes(term)));
  const svc = services.filter(
    (s) => (cat === "All" || cat === "Services") && (!term || s.name.toLowerCase().includes(term)),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a widget"
      subtitle="Tiles are added to the end of the current board."
      width="max-w-3xl"
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search widgets…"
            className={cx(inputClass, "pl-9")}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cx(
                "px-3 h-10 rounded-xl text-sm font-medium whitespace-nowrap transition",
                cat === c ? "bg-accent/15 text-fg" : "text-fg-2 hover:bg-[var(--hover)]",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {showBoard && (
        <button
          type="button"
          onClick={onAddProxmoxBoard}
          className="group w-full flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3.5 mb-2.5 text-left hover:bg-accent/15 transition"
        >
          <div className="size-10 shrink-0 rounded-xl bg-accent/20 grid place-items-center text-accent">
            <LayoutDashboard size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Create a Proxmox board</div>
            <p className="text-xs text-fg-2 mt-0.5">
              A new board with the cluster overview, a tile for each node, your VMs &amp; containers and storage.
            </p>
          </div>
          <Plus size={16} className="text-fg-3 group-hover:text-accent shrink-0" />
        </button>
      )}

      {widgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {widgets.map(([type, w]) => (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="group flex items-start gap-3 rounded-2xl border border-line bg-[var(--input)] p-3.5 text-left hover:border-accent/60 hover:bg-accent/5 transition"
            >
              <div className="size-10 shrink-0 rounded-xl bg-accent/15 grid place-items-center text-accent">
                <w.icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{w.name}</span>
                  <span className="text-[11px] text-fg-3 tabular-nums">
                    {w.size.w}×{w.size.h}
                  </span>
                </div>
                <p className="text-xs text-fg-2 mt-0.5 leading-relaxed">{w.description}</p>
              </div>
              <Plus size={16} className="text-fg-3 group-hover:text-accent mt-0.5 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {svc.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3 mb-3">Service tiles</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {svc.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onAdd("service", { serviceId: s.id })}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-[var(--input)] p-2.5 text-left hover:border-accent/60 transition"
              >
                <ServiceIcon src={s.icon} name={s.name} size={26} />
                <span className="text-sm truncate flex-1">{s.name}</span>
                {onBoard.has(s.id) ? (
                  <span className="text-[10px] text-fg-3">Added</span>
                ) : (
                  <Plus size={14} className="text-fg-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {widgets.length === 0 && svc.length === 0 && !showBoard && (
        <p className="text-sm text-fg-3 py-8 text-center">No widgets match “{q}”.</p>
      )}
    </Modal>
  );
}
