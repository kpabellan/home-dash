"use client";

import { useState } from "react";
import { AlarmClock, AudioLines, Moon, Music, Pause, Play, Plus, Upload, X } from "lucide-react";
import { useDash, useNow } from "../DashContext";
import { DEFAULT_TRACK_VOLUME, nextRun, useSound, useSoundLibrary } from "../SoundEngine";
import { EmptyState, SetupButton, WidgetHeader } from "./common";
import { cx } from "../ui";
import { formatTime, soundTitle } from "@/lib/format";

const SLEEP_STEPS = [0, 15, 30, 60, 90, 120];

function Eq() {
  return (
    <span className="eq shrink-0" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

// A list of sounds, each with its own volume, plus an inline picker to add
// more. Used by the tile (what's playing) and by each schedule.
export function TrackList({ tracks, onChange, library, playing, onManage }) {
  const [adding, setAdding] = useState(false);
  const available = library.filter((s) => !tracks.some((t) => t.id === s.id));
  const known = new Set(library.map((s) => s.id));

  const setVolume = (id, volume) => onChange(tracks.map((t) => (t.id === id ? { ...t, volume } : t)));
  const remove = (id) => onChange(tracks.filter((t) => t.id !== id));
  const add = (id) => {
    onChange([...tracks, { id, volume: DEFAULT_TRACK_VOLUME }]);
    setAdding(false);
  };

  return (
    <div className="space-y-1.5">
      {tracks.map((t) => {
        const title = soundTitle(t.id);
        const missing = library.length > 0 && !known.has(t.id);
        return (
          <div
            key={t.id}
            className="flex items-center gap-2.5 h-10 rounded-xl bg-[var(--input)] border border-line pl-3 pr-1"
          >
            {playing && !missing ? <Eq /> : <AudioLines size={13} className="shrink-0 text-fg-3" />}
            <span
              className={cx("w-[36%] min-w-0 truncate text-[13px]", missing && "text-fg-3 line-through")}
              title={missing ? `${title} isn't in the library anymore` : title}
            >
              {title}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={t.volume ?? DEFAULT_TRACK_VOLUME}
              onChange={(e) => setVolume(t.id, Number(e.target.value))}
              aria-label={`${title} volume`}
              className="flex-1 min-w-0"
            />
            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-fg-3">
              {t.volume ?? DEFAULT_TRACK_VOLUME}
            </span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label={`Remove ${title}`}
              className="size-7 shrink-0 grid place-items-center rounded-lg text-fg-3 hover:text-fg hover:bg-[var(--hover)] transition"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-xl border border-line bg-[var(--input)] p-1 pop-in">
          <div className="flex items-center justify-between pl-2 pr-0.5 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Add a sound</span>
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label="Close"
              className="size-6 grid place-items-center rounded-md text-fg-3 hover:text-fg hover:bg-[var(--hover)]"
            >
              <X size={13} />
            </button>
          </div>
          {available.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => add(s.id)}
              className="w-full flex items-center gap-2 h-9 px-2 rounded-lg text-left text-[13px] hover:bg-[var(--hover)] transition"
            >
              <Plus size={14} className="shrink-0 text-accent" />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
          {available.length === 0 && (
            <p className="px-2 pb-1.5 text-xs text-fg-3">
              {library.length ? "Every sound in your library is already here." : "Your library is empty."}
            </p>
          )}
          {onManage && (
            <button
              type="button"
              onClick={onManage}
              className="w-full flex items-center gap-2 h-9 px-2 rounded-lg text-left text-[13px] text-fg-2 hover:text-fg hover:bg-[var(--hover)] transition"
            >
              <Upload size={14} className="shrink-0" />
              Upload more sounds
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-[13px] text-fg-2 hover:text-fg hover:border-accent/50 hover:bg-[var(--hover)] transition"
        >
          <Plus size={15} /> Add sound
        </button>
      )}
    </div>
  );
}

export function scheduleLabel(at, now, hour12) {
  const time = formatTime(at, { hour12 });
  return at.toDateString() === now.toDateString() ? time : `${at.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

export function SoundsWidget({ h }) {
  const { settings, updateSettings, openSettings } = useDash();
  const sound = useSound();
  const { data } = useSoundLibrary();
  const now = useNow(15000);
  const [sleepStep, setSleepStep] = useState(0);

  const { tracks } = settings.sounds;
  const library = data?.sounds ?? [];
  const next = nextRun(settings.sounds.schedules, now);
  const names = tracks.map((t) => soundTitle(t.id)).join(" · ");

  if (data && !library.length && !tracks.length) {
    return (
      <EmptyState
        icon={Music}
        title="No sounds yet"
        hint="Upload audio files, or copy them into the server's sounds folder."
        action={<SetupButton tab="sounds">Add sounds</SetupButton>}
      />
    );
  }

  const sleepLeft = sound.stopAt ? Math.max(1, Math.ceil((sound.stopAt - Date.now()) / 60000)) : 0;
  const cycleSleep = () => {
    const i = sound.stopAt ? (sleepStep + 1) % SLEEP_STEPS.length : 1;
    setSleepStep(i);
    sound.setSleep(SLEEP_STEPS[i]);
  };

  const playButton = (
    <button
      type="button"
      onClick={sound.toggle}
      disabled={!tracks.length}
      aria-label={sound.playing ? "Pause" : "Play"}
      className="size-10 shrink-0 grid place-items-center rounded-full bg-accent text-[var(--accent-fg)] hover:brightness-110 transition disabled:opacity-40"
    >
      {sound.playing ? (
        <Pause size={18} fill="currentColor" />
      ) : (
        <Play size={18} fill="currentColor" className="ml-0.5" />
      )}
    </button>
  );

  if (h === 1) {
    return (
      <div className="h-full flex items-center gap-3 px-4">
        {playButton}
        <div className="min-w-0">
          <div className="text-sm text-fg truncate">{names || "No sounds added"}</div>
          <div className="text-xs text-fg-3">
            {sound.playing ? `Playing ${tracks.length} sound${tracks.length === 1 ? "" : "s"}` : "Paused"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <WidgetHeader
        icon={Music}
        title="Sounds"
        right={
          <button
            type="button"
            onClick={() => openSettings("sounds")}
            className="inline-flex items-center gap-1 hover:text-fg transition"
            title="Schedules"
          >
            <AlarmClock size={12} />
            {next ? scheduleLabel(next.at, now, settings.clock.hour12) : "Schedule"}
          </button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <TrackList
          tracks={tracks}
          onChange={(tracks) => updateSettings("sounds", { tracks })}
          library={library}
          playing={sound.playing}
          onManage={() => openSettings("sounds")}
        />
      </div>
      <div className="flex items-center gap-3">
        {playButton}
        <div className="flex-1 min-w-0 text-[13px] text-fg-2 truncate">
          {!tracks.length
            ? "Add a sound to start"
            : sound.playing
              ? `Playing ${tracks.length} sound${tracks.length === 1 ? "" : "s"}`
              : "Paused"}
        </div>
        {sound.playing && (
          <button
            type="button"
            onClick={cycleSleep}
            title="Sleep timer"
            className={cx(
              "h-8 shrink-0 inline-flex items-center gap-1 rounded-lg px-2 text-xs tabular-nums transition",
              sound.stopAt ? "bg-accent/15 text-fg" : "text-fg-3 hover:text-fg hover:bg-[var(--hover)]",
            )}
          >
            <Moon size={13} />
            {sound.stopAt ? `${sleepLeft}m` : "Sleep"}
          </button>
        )}
      </div>
    </div>
  );
}
