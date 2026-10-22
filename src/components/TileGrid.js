"use client";

import { Component, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, GripVertical, MoveDiagonal2, Settings2, Trash2 } from "lucide-react";
import { WIDGETS } from "./widgets/registry";
import { useElementSize } from "./charts";
import { cx } from "./ui";

class WidgetBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full grid place-items-center p-4 text-center text-xs text-fg-3">
          <div>
            <AlertCircle size={18} className="mx-auto mb-1.5" />
            This widget crashed.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Responsive column model. On wide screens tiles use their stored width
 * directly; tablets halve the grid; phones use two columns where anything
 * wider than a third of the board goes full width.
 */
function useGridModel(width, { columns, gap }) {
  if (!width) return { mode: "full", cols: columns, cellW: 0 };
  if (width < 560) return { mode: "phone", cols: 2, cellW: (width - gap) / 2 };
  const cellW = (width - gap * (columns - 1)) / columns;
  if (cellW >= 64) return { mode: "full", cols: columns, cellW };
  const cols = Math.ceil(columns / 2);
  return { mode: "half", cols, cellW: (width - gap * (cols - 1)) / cols };
}

function spanFor(w, model, columns) {
  if (model.mode === "phone") return w >= columns / 3 ? 2 : 1;
  if (model.mode === "half") return clamp(Math.round(w / 2), 1, model.cols);
  return Math.min(w, model.cols);
}

function widthFromSpan(span, model) {
  return model.mode === "half" ? span * 2 : span;
}

// Widgets pick their layout from a width hint measured in "reference cells"
// (~one column of a full-width 12-column board), so a tile renders its compact
// form on phones and narrow windows even though its stored width is larger.
function widthUnits(tile, span, model, gap) {
  if (!model.cellW) return tile.w;
  return Math.max(1, Math.floor((span * (model.cellW + gap)) / 121 + 0.25));
}

export default function TileGrid({ tiles, layout, editMode, onMove, onResize, onRemove, onConfigure }) {
  const [sizeRef, { width }] = useElementSize();
  const model = useGridModel(width, layout);
  const { gap, rowHeight, columns } = layout;

  const [dragId, setDragId] = useState(null);
  const drag = useRef(null);
  const ghostRef = useRef(null);
  const tileEls = useRef(new Map());

  // ---- FLIP: animate tiles to their new spots when the layout changes ----
  const prevRects = useRef(new Map());
  const prevSig = useRef("");
  const sig = tiles.map((t) => `${t.id}:${t.w}x${t.h}`).join("|") + `|${model.cols}`;

  useLayoutEffect(() => {
    const container = sizeRef.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const next = new Map();
    tileEls.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next.set(id, { x: r.left - origin.left, y: r.top - origin.top });
    });
    const reduce =
      document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prevSig.current && prevSig.current !== sig && !reduce) {
      next.forEach((pos, id) => {
        const prev = prevRects.current.get(id);
        const el = tileEls.current.get(id);
        if (!prev || !el) return;
        const dx = prev.x - pos.x;
        const dy = prev.y - pos.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: 260,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          });
        }
      });
    }
    prevRects.current = next;
    prevSig.current = sig;
  });

  // ---- Drag to reorder ---------------------------------------------------
  const onPointerDown = (e, tile) => {
    if (!editMode || e.button !== 0 || e.target.closest("[data-no-drag]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = {
      id: tile.id,
      started: false,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      lastSwap: 0,
      lastOver: null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      d.started = true;
      setDragId(d.id);
    }
    d.x = e.clientX - d.offX;
    d.y = e.clientY - d.offY;
    if (ghostRef.current) {
      ghostRef.current.style.left = `${d.x}px`;
      ghostRef.current.style.top = `${d.y}px`;
    }

    if (e.clientY < 70) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);

    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-tile-id]");
    const overId = over?.dataset.tileId;
    const now = performance.now();
    if (overId && overId !== d.id && (overId !== d.lastOver || now - d.lastSwap > 350) && now - d.lastSwap > 120) {
      d.lastSwap = now;
      d.lastOver = overId;
      onMove(d.id, overId);
    }
  };

  const endDrag = () => {
    drag.current = null;
    setDragId(null);
  };

  // ---- Resize ------------------------------------------------------------
  const resize = useRef(null);

  const onResizeDown = (e, tile) => {
    e.stopPropagation();
    e.preventDefault();
    resize.current = {
      id: tile.id,
      startX: e.clientX,
      startY: e.clientY,
      span: spanFor(tile.w, model, columns),
      h: tile.h,
      def: WIDGETS[tile.type],
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizeMove = (e) => {
    const r = resize.current;
    if (!r) return;
    const colStep = model.cellW + gap;
    const rowStep = rowHeight + gap;
    const minSpan = model.mode === "half" ? Math.ceil(r.def.min.w / 2) : r.def.min.w;
    const span = clamp(
      r.span + Math.round((e.clientX - r.startX) / colStep),
      Math.min(minSpan, model.cols),
      model.cols,
    );
    const h = clamp(r.h + Math.round((e.clientY - r.startY) / rowStep), r.def.min.h, r.def.max.h);
    const w = clamp(widthFromSpan(span, model), r.def.min.w, r.def.max.w);
    onResize(r.id, w, h);
  };

  const endResize = () => {
    resize.current = null;
  };

  const dragging = dragId ? tiles.find((t) => t.id === dragId) : null;

  return (
    <div ref={sizeRef} className={cx("relative w-full", editMode && "editing")}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${model.cols}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
          gridAutoFlow: "dense",
          gap: `${gap}px`,
        }}
      >
        {tiles.map((tile) => {
          const def = WIDGETS[tile.type];
          if (!def) return null;
          const span = spanFor(tile.w, model, columns);
          return (
            <div
              key={tile.id}
              ref={(el) => (el ? tileEls.current.set(tile.id, el) : tileEls.current.delete(tile.id))}
              data-tile-id={tile.id}
              className={cx("tile glass", def.link && !editMode && "is-link", dragId === tile.id && "is-placeholder")}
              style={{ gridColumn: `span ${span}`, gridRow: `span ${tile.h}` }}
              onPointerDown={(e) => onPointerDown(e, tile)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div className="tile-inner">
                <WidgetBoundary>
                  <def.component
                    tile={tile}
                    w={widthUnits(tile, span, model, gap)}
                    h={tile.h}
                    config={tile.config ?? {}}
                  />
                </WidgetBoundary>
              </div>
              {editMode && (
                <TileControls
                  tile={tile}
                  def={def}
                  canResize={model.mode !== "phone"}
                  onConfigure={onConfigure}
                  onRemove={onRemove}
                  onResizeDown={onResizeDown}
                  onResizeMove={onResizeMove}
                  onResizeEnd={endResize}
                />
              )}
            </div>
          );
        })}
      </div>

      {dragging && drag.current && (
        <div
          ref={ghostRef}
          className="tile-ghost glass"
          style={{
            left: drag.current.x,
            top: drag.current.y,
            width: drag.current.width,
            height: drag.current.height,
          }}
        >
          <div className="tile-inner">
            <WidgetBoundary>
              {(() => {
                const def = WIDGETS[dragging.type];
                const span = spanFor(dragging.w, model, columns);
                return (
                  <def.component
                    tile={dragging}
                    w={widthUnits(dragging, span, model, gap)}
                    h={dragging.h}
                    config={dragging.config ?? {}}
                  />
                );
              })()}
            </WidgetBoundary>
          </div>
        </div>
      )}
    </div>
  );
}

function TileControls({ tile, def, canResize, onConfigure, onRemove, onResizeDown, onResizeMove, onResizeEnd }) {
  const btn =
    "size-7 grid place-items-center rounded-lg bg-[rgb(var(--tile-rgb)/0.88)] border border-line text-fg-2 hover:text-fg backdrop-blur-md transition";
  return (
    <div className="tile-controls">
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-[rgb(var(--tile-rgb)/0.88)] border border-line px-1.5 py-1 text-[11px] font-medium text-fg-2 backdrop-blur-md max-w-[calc(100%-5rem)]">
        <GripVertical size={12} className="shrink-0" />
        <span className="truncate">{def.name}</span>
        <span className="text-fg-3 tabular-nums shrink-0">
          {tile.w}×{tile.h}
        </span>
      </div>
      <div className="absolute right-2 top-2 flex gap-1" data-no-drag>
        {def.fields && (
          <button
            type="button"
            className={btn}
            aria-label={`Configure ${def.name}`}
            onClick={() => onConfigure(tile.id)}
          >
            <Settings2 size={14} />
          </button>
        )}
        <button
          type="button"
          className={cx(btn, "hover:!text-[var(--bad)]")}
          aria-label={`Remove ${def.name}`}
          onClick={() => onRemove(tile.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {canResize && (
        <div
          className="resize-grip"
          data-no-drag
          title="Drag to resize"
          onPointerDown={(e) => onResizeDown(e, tile)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
        >
          <MoveDiagonal2 size={12} />
        </div>
      )}
    </div>
  );
}
