"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  LayoutDashboard,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ServerCog,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { DashContext } from "./DashContext";
import Background from "./Background";
import TileGrid from "./TileGrid";
import SettingsPanel from "./SettingsPanel";
import WidgetLibrary from "./WidgetLibrary";
import TileConfigModal from "./TileConfigModal";
import CommandPalette from "./CommandPalette";
import { WIDGETS } from "./widgets/registry";
import { Button, IconButton, cx } from "./ui";
import {
  defaultState,
  defaultTiles,
  hydrate,
  loadState,
  loadUpload,
  saveState,
  saveUpload,
  tile as makeTile,
} from "@/lib/store";
import { uid } from "@/lib/format";

function contrastText(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex ?? "");
  if (!m) return "#0b0d12";
  const [r, g, b] = m.slice(1).map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#0b0d12" : "#ffffff";
}

export default function Dashboard({ services, proxmox = false }) {
  const [state, setState] = useState(null);
  const [upload, setUploadState] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [scrollTo, setScrollTo] = useState(null);

  // ---- Load & persist ----------------------------------------------------
  useEffect(() => {
    setState(loadState(services));
    setUploadState(loadUpload());
  }, [services]);

  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => saveState(state), 250);
    return () => clearTimeout(t);
  }, [state]);

  // ---- Theme -------------------------------------------------------------
  const appearance = state?.settings.appearance;
  useEffect(() => {
    if (!appearance) return;
    const root = document.documentElement;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      root.dataset.theme = appearance.theme === "auto" ? (mq.matches ? "light" : "dark") : appearance.theme;
    };
    apply();
    root.style.setProperty("--accent", appearance.accent);
    root.style.setProperty("--accent-fg", contrastText(appearance.accent));
    root.style.setProperty("--tile-alpha", String(appearance.tileOpacity / 100));
    root.style.setProperty("--tile-blur", `${appearance.tileBlur}px`);
    root.style.setProperty("--radius", `${appearance.radius}px`);
    root.dataset.borders = appearance.tileBorders ? "on" : "off";
    root.dataset.motion = appearance.reduceMotion ? "reduce" : "full";
    if (appearance.theme !== "auto") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [appearance]);

  // ---- Toasts ------------------------------------------------------------
  const toast = useCallback((message, action) => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, message, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3500);
  }, []);

  // ---- Mutations ---------------------------------------------------------
  const update = useCallback((section, patch) => {
    setState((s) => ({ ...s, settings: { ...s.settings, [section]: { ...s.settings[section], ...patch } } }));
  }, []);

  const setTiles = useCallback((fn) => {
    setState((s) => {
      let changed = false;
      const boards = s.boards.map((b) => {
        if (b.id !== s.activeBoard) return b;
        const tiles = fn(b.tiles);
        if (tiles === b.tiles) return b;
        changed = true;
        return { ...b, tiles };
      });
      return changed ? { ...s, boards } : s;
    });
  }, []);

  const moveTile = useCallback(
    (dragId, overId) =>
      setTiles((tiles) => {
        const from = tiles.findIndex((t) => t.id === dragId);
        const to = tiles.findIndex((t) => t.id === overId);
        if (from < 0 || to < 0 || from === to) return tiles;
        const next = [...tiles];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      }),
    [setTiles],
  );

  const resizeTile = useCallback(
    (id, w, h) =>
      setTiles((tiles) => {
        const t = tiles.find((x) => x.id === id);
        if (!t || (t.w === w && t.h === h)) return tiles;
        return tiles.map((x) => (x.id === id ? { ...x, w, h } : x));
      }),
    [setTiles],
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const removeTile = useCallback(
    (id) => {
      const s = stateRef.current;
      const tiles = s.boards.find((b) => b.id === s.activeBoard)?.tiles ?? [];
      const index = tiles.findIndex((t) => t.id === id);
      const removed = tiles[index];
      if (!removed) return;
      setTiles((all) => all.filter((t) => t.id !== id));
      toast(`Removed ${WIDGETS[removed.type]?.name ?? "tile"}`, {
        label: "Undo",
        run: () =>
          setTiles((all) => {
            const next = [...all];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
      });
    },
    [setTiles, toast],
  );

  const addTile = useCallback(
    (type, config = {}) => {
      const def = WIDGETS[type];
      const t = makeTile(type, def.size.w, def.size.h, config);
      setTiles((tiles) => [...tiles, t]);
      setLibraryOpen(false);
      setEditMode(true);
      setScrollTo(t.id);
    },
    [setTiles],
  );

  const updateTileConfig = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      boards: s.boards.map((b) => ({
        ...b,
        tiles: b.tiles.map((t) => (t.id === id ? { ...t, config: { ...t.config, ...patch } } : t)),
      })),
    }));
  }, []);

  useEffect(() => {
    if (!scrollTo) return;
    const el = document.querySelector(`[data-tile-id="${scrollTo}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.animate([{ boxShadow: "0 0 0 3px var(--accent)" }, { boxShadow: "0 0 0 0 transparent" }], {
      duration: 1400,
      easing: "ease-out",
    });
    setScrollTo(null);
  }, [scrollTo, state]);

  // ---- Boards ------------------------------------------------------------
  const switchBoard = useCallback((id) => setState((s) => ({ ...s, activeBoard: id })), []);

  const addBoard = () => {
    const id = uid();
    setState((s) => ({
      ...s,
      boards: [...s.boards, { id, name: `Board ${s.boards.length + 1}`, tiles: [] }],
      activeBoard: id,
    }));
    setEditMode(true);
    setRenaming(id);
  };

  const renameBoard = (id, name) => {
    setState((s) => ({ ...s, boards: s.boards.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b)) }));
    setRenaming(null);
  };

  const deleteBoard = (id) => {
    const board = state.boards.find((b) => b.id === id);
    if (!window.confirm(`Delete the board “${board.name}” and its ${board.tiles.length} tiles?`)) return;
    setState((s) => {
      const boards = s.boards.filter((b) => b.id !== id);
      return { ...s, boards, activeBoard: s.activeBoard === id ? boards[0].id : s.activeBoard };
    });
  };

  // Builds a board from the live cluster: overview, one tile per node, guests
  // and storage. Node tiles share a row (up to four across).
  const addProxmoxBoard = useCallback(async () => {
    setLibraryOpen(false);
    let data = null;
    try {
      data = await (await fetch("/api/proxmox", { cache: "no-store" })).json();
    } catch {}
    if (!data) return toast("Couldn't reach the dashboard server.");
    if (!data.configured) return toast("Proxmox isn't connected yet. See the README to set it up.");
    if (data.error) return toast(data.error);

    const count = data.nodes.length;
    const nodeW = count <= 1 ? 12 : count === 2 ? 6 : count === 3 ? 4 : 3;
    const name = data.cluster.name ?? "Proxmox";
    const id = uid();
    const tiles = [
      makeTile("pve-cluster", 12, 3),
      ...data.nodes.map((n) => makeTile("pve-node", nodeW, 3, { node: n.name })),
      makeTile("pve-guests", 8, 5, { sort: "cpu" }),
      makeTile("pve-storage", 4, 5),
    ];
    setState((s) => ({ ...s, boards: [...s.boards, { id, name, tiles }], activeBoard: id }));
    toast(`Created the “${name}” board`);
  }, [toast]);

  // ---- Data --------------------------------------------------------------
  const resetLayout = () => {
    if (!window.confirm("Reset this board to its default layout?")) return;
    const first = state.boards[0].id === state.activeBoard;
    setTiles(() => (first ? defaultTiles(services) : []));
    toast("Board layout reset");
  };

  const resetAll = () => {
    if (!window.confirm("Reset all boards, settings and backgrounds to defaults?")) return;
    setState(defaultState(services));
    saveUpload(null);
    setUploadState(null);
    setSettingsOpen(false);
    toast("Everything was reset");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `home-dash-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file) => {
    try {
      const raw = JSON.parse(await file.text());
      if (!Array.isArray(raw.boards)) throw new Error("bad file");
      setState(hydrate(raw, services));
      toast("Settings imported");
    } catch {
      toast("That file isn't a Home Dash export.");
    }
  };

  const setUpload = (dataUrl) => {
    try {
      saveUpload(dataUrl);
      setUploadState(dataUrl);
    } catch {
      toast("Image is too large to store — try a smaller one.");
    }
  };

  const openSettings = useCallback((tab = "appearance") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  // ---- Keyboard ----------------------------------------------------------
  const overlayOpen = settingsOpen || libraryOpen || paletteOpen || !!configId;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const t = e.target;
      if (overlayOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key.toLowerCase() === "e") setEditMode((m) => !m);
      else if (e.key === ",") openSettings();
      else if (e.key === "Escape" && editMode) setEditMode(false);
      else if (/^[1-9]$/.test(e.key) && state?.boards[Number(e.key) - 1])
        switchBoard(state.boards[Number(e.key) - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, editMode, openSettings, switchBoard, state?.boards]);

  // ---- Context -----------------------------------------------------------
  const servicesById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const ctx = useMemo(
    () =>
      state && {
        settings: state.settings,
        services,
        servicesById,
        proxmoxAvailable: proxmox,
        editMode,
        openSettings,
        updateTileConfig,
        toast,
      },
    [state, services, servicesById, proxmox, editMode, openSettings, updateTileConfig, toast],
  );

  const paletteActions = useMemo(() => {
    if (!state) return [];
    const dark = document.documentElement.dataset.theme !== "light";
    return [
      {
        id: "a:edit",
        label: editMode ? "Finish editing" : "Edit layout",
        icon: Pencil,
        run: () => setEditMode((m) => !m),
      },
      { id: "a:add", label: "Add a widget", icon: Plus, run: () => setLibraryOpen(true) },
      { id: "a:settings", label: "Open settings", icon: Settings, run: () => openSettings() },
      {
        id: "a:theme",
        label: dark ? "Switch to light theme" : "Switch to dark theme",
        icon: dark ? Sun : Moon,
        run: () => update("appearance", { theme: dark ? "light" : "dark" }),
      },
      { id: "a:board", label: "New board", icon: LayoutDashboard, run: addBoard },
      { id: "a:pve", label: "Create a Proxmox board", icon: ServerCog, run: addProxmoxBoard },
    ];
  }, [state, editMode, openSettings, update, addProxmoxBoard]);

  if (!state || !ctx) return null;

  const { settings } = state;
  const board = state.boards.find((b) => b.id === state.activeBoard) ?? state.boards[0];
  const configTile = configId ? board.tiles.find((t) => t.id === configId) : null;
  const showTabs = state.boards.length > 1 || editMode;

  return (
    <DashContext.Provider value={ctx}>
      <Background appearance={settings.appearance} upload={upload} />

      <main
        className="mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-28 fade-in"
        style={{ maxWidth: settings.layout.maxWidth }}
      >
        {settings.general.showHeader ? (
          <header className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6">
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight [text-shadow:0_1px_12px_rgb(0_0_0/0.25)]">
              {settings.general.title}
            </h1>

            {showTabs && (
              <nav className="glass rounded-2xl p-1 flex items-center gap-0.5 max-w-full overflow-x-auto no-scrollbar order-last sm:order-none w-full sm:w-auto">
                {state.boards.map((b) =>
                  renaming === b.id ? (
                    <input
                      key={b.id}
                      autoFocus
                      defaultValue={b.name}
                      onBlur={(e) => renameBoard(b.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="h-8 w-28 rounded-xl bg-[var(--input)] px-2.5 text-sm outline-none ring-2 ring-accent/50"
                    />
                  ) : (
                    <div key={b.id} className="relative group/tab">
                      <button
                        type="button"
                        onClick={() => switchBoard(b.id)}
                        onDoubleClick={() => editMode && setRenaming(b.id)}
                        className={cx(
                          "h-8 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition",
                          b.id === board.id
                            ? "bg-accent/20 text-fg"
                            : "text-fg-2 hover:text-fg hover:bg-[var(--hover)]",
                          editMode && state.boards.length > 1 && "pr-7",
                        )}
                        title={editMode ? "Double-click to rename" : undefined}
                      >
                        {b.name}
                      </button>
                      {editMode && state.boards.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Delete ${b.name}`}
                          onClick={() => deleteBoard(b.id)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-md text-fg-3 hover:text-fg hover:bg-[var(--hover)]"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ),
                )}
                {editMode && (
                  <button
                    type="button"
                    onClick={addBoard}
                    aria-label="New board"
                    className="size-8 grid place-items-center rounded-xl text-fg-2 hover:text-fg hover:bg-[var(--hover)]"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </nav>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="glass h-11 rounded-2xl pl-3.5 pr-2.5 flex items-center gap-2.5 text-sm text-fg-2 hover:text-fg transition sm:w-64"
              >
                <Search size={16} />
                <span className="hidden sm:inline flex-1 text-left">Search…</span>
                <span className="kbd hidden sm:inline">Ctrl K</span>
              </button>
              <div className="glass rounded-2xl p-1 flex items-center">
                <IconButton
                  label={editMode ? "Finish editing (E)" : "Edit layout (E)"}
                  active={editMode}
                  onClick={() => setEditMode((m) => !m)}
                >
                  <Pencil size={17} />
                </IconButton>
                <IconButton label="Settings" onClick={() => openSettings()}>
                  <Settings size={17} />
                </IconButton>
              </div>
            </div>
          </header>
        ) : (
          <div className="fixed top-3 right-3 z-30 glass rounded-2xl p-1 flex opacity-0 hover:opacity-100 focus-within:opacity-100 transition">
            <IconButton label="Edit layout" active={editMode} onClick={() => setEditMode((m) => !m)}>
              <Pencil size={17} />
            </IconButton>
            <IconButton label="Settings" onClick={() => openSettings()}>
              <Settings size={17} />
            </IconButton>
          </div>
        )}

        {board.tiles.length === 0 ? (
          <div className="glass rounded-3xl py-20 px-6 text-center fade-in">
            <LayoutDashboard size={28} className="mx-auto text-fg-3 mb-3" />
            <h2 className="text-lg font-semibold">This board is empty</h2>
            <p className="text-sm text-fg-2 mt-1 mb-5">Add widgets, metrics and service tiles to build it out.</p>
            <Button variant="primary" onClick={() => setLibraryOpen(true)}>
              <Plus size={16} /> Add a widget
            </Button>
          </div>
        ) : (
          <TileGrid
            key={board.id}
            tiles={board.tiles}
            layout={settings.layout}
            editMode={editMode}
            onMove={moveTile}
            onResize={resizeTile}
            onRemove={removeTile}
            onConfigure={setConfigId}
          />
        )}
      </main>

      {editMode && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 panel pop-in rounded-2xl p-2 flex items-center gap-1.5 shadow-2xl max-w-[calc(100vw-2rem)]">
          <span className="hidden md:flex items-center gap-2 px-2.5 text-sm text-fg-2 whitespace-nowrap">
            <Pencil size={14} /> Drag to move · pull a corner to resize
          </span>
          <Button onClick={() => setLibraryOpen(true)}>
            <Plus size={15} /> Add widget
          </Button>
          <Button variant="ghost" onClick={resetLayout} title="Reset layout">
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button variant="primary" onClick={() => setEditMode(false)}>
            <Check size={15} /> Done
          </Button>
        </div>
      )}

      <div className="fixed bottom-5 left-5 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="panel pop-in rounded-xl pl-4 pr-2 py-2 flex items-center gap-3 text-sm shadow-xl">
            {t.message}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="rounded-lg px-2 py-1 font-medium text-accent hover:bg-accent/10"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      <SettingsPanel
        open={settingsOpen}
        tab={settingsTab}
        setTab={setSettingsTab}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={update}
        upload={upload}
        onUpload={setUpload}
        toast={toast}
        onExport={exportData}
        onImport={importData}
        onResetLayout={resetLayout}
        onResetAll={resetAll}
      />
      <WidgetLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdd={addTile}
        onAddProxmoxBoard={addProxmoxBoard}
        services={services}
        tiles={board.tiles}
      />
      {configTile && (
        <TileConfigModal
          key={configTile.id}
          tile={configTile}
          services={services}
          onClose={() => setConfigId(null)}
          onSave={(id, config) => {
            updateTileConfig(id, config);
            setConfigId(null);
          }}
        />
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        services={services}
        actions={paletteActions}
        boards={state.boards}
        onBoard={switchBoard}
        settings={settings}
      />
    </DashContext.Provider>
  );
}
