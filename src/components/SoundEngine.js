"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Play, Volume2, X } from "lucide-react";
import { usePoll } from "@/lib/usePoll";
import { soundTitle } from "@/lib/format";
import { Button, IconButton } from "./ui";

export const SoundContext = createContext(null);

export function useSound() {
  return useContext(SoundContext);
}

export function useSoundLibrary() {
  return usePoll("/api/sounds", { interval: 60000 });
}

export const soundUrl = (id) => `/api/sounds/${encodeURIComponent(id)}`;

export const DEFAULT_TRACK_VOLUME = 70;

const POSITIONS_KEY = "homedash:v2:sound-pos";
const FIRED_KEY = "homedash:v2:sound-fired";
// A schedule still fires if the tab wakes up (or the page loads) this late.
const LATE_MS = 10 * 60 * 1000;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Squaring makes volume sliders feel even across their range.
const trackGain = (volume) => (volume / 100) ** 2;

function ramp(ctx, param, value, seconds) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + Math.max(0.02, seconds));
}

function occurrence(schedule, day) {
  const [h, m] = schedule.time.split(":").map(Number);
  const at = new Date(day);
  at.setHours(h, m, 0, 0);
  return at;
}

const runnable = (s) => s.enabled && s.days?.length && s.tracks?.length;

export function nextRun(schedules, now = new Date()) {
  let best = null;
  for (const s of schedules ?? []) {
    if (!runnable(s)) continue;
    for (let i = 0; i < 8; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() + i);
      const at = occurrence(s, day);
      if (at > now && s.days.includes(at.getDay())) {
        if (!best || at < best.at) best = { schedule: s, at };
        break;
      }
    }
  }
  return best;
}

function dueSchedule(schedules, now, fired) {
  for (const s of schedules ?? []) {
    if (!runnable(s)) continue;
    const at = occurrence(s, now);
    const late = now - at;
    const key = at.toDateString();
    if (late >= 0 && late < LATE_MS && s.days.includes(at.getDay()) && fired[s.id] !== key) return { s, key };
  }
  return null;
}

// One player for the whole dashboard, so sound keeps going while you switch
// boards or edit tiles, and schedules run even with no Sounds tile showing.
// Each sound loops through its own gain (its volume) into a master gain that
// handles fades.
export function useSoundEngine(sounds, update, toast) {
  const engine = useRef(null);
  const fadeTimer = useRef(null);
  // Sounds a schedule added to something already playing, and when to stop them.
  const removals = useRef([]);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [stopAt, setStopAt] = useState(null);
  const latest = useRef(null);
  latest.current = { sounds, playing, stopAt };

  // Long mixes resume where they left off instead of starting over each time.
  const remember = useCallback(() => {
    const e = engine.current;
    if (!e) return;
    const positions = readJson(POSITIONS_KEY);
    for (const [id, d] of e.decks) if (d.el.currentTime > 0) positions[id] = Math.floor(d.el.currentTime);
    writeJson(POSITIONS_KEY, positions);
  }, []);

  const ensure = useCallback(() => {
    if (!engine.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      engine.current = { ctx, master, decks: new Map() };
    }
    return engine.current;
  }, []);

  // Makes the playing decks match the track list: fades new sounds in and
  // removed ones out, and moves changed volumes over `fade` seconds. Volumes
  // that haven't changed are left alone, so a slow fade isn't cut short.
  const sync = useCallback(
    (tracks, fade = 0) => {
      const e = engine.current;
      if (!e) return;
      const wanted = new Set(tracks.map((t) => t.id));
      for (const [id, d] of e.decks) {
        if (wanted.has(id)) continue;
        remember();
        e.decks.delete(id);
        const out = Math.max(0.3, fade);
        ramp(e.ctx, d.gain.gain, 0, out);
        setTimeout(
          () => {
            d.el.pause();
            d.el.removeAttribute("src");
            d.el.load();
            d.source.disconnect();
          },
          out * 1000 + 50,
        );
      }
      for (const t of tracks) {
        let d = e.decks.get(t.id);
        const added = !d;
        if (added) {
          const el = new Audio();
          el.loop = true;
          el.preload = "auto";
          const gain = e.ctx.createGain();
          gain.gain.value = 0;
          const source = e.ctx.createMediaElementSource(el);
          source.connect(gain).connect(e.master);
          el.addEventListener("error", () => {
            if (e.decks.get(t.id)?.el === el) toast(`Couldn't load “${soundTitle(t.id)}”. Is it still in the library?`);
          });
          const at = readJson(POSITIONS_KEY)[t.id];
          el.src = soundUrl(t.id) + (at ? `#t=${at}` : "");
          d = { el, gain, source, volume: null };
          e.decks.set(t.id, d);
          if (latest.current.playing) el.play().catch(() => {});
        }
        const volume = t.volume ?? DEFAULT_TRACK_VOLUME;
        if (volume === d.volume) continue;
        d.volume = volume;
        ramp(e.ctx, d.gain.gain, trackGain(volume), Math.max(added ? 0.8 : 0.06, fade));
      }
    },
    [remember, toast],
  );

  const play = useCallback(
    async ({ tracks, fadeIn = 0.4, stopAfter = 0 } = {}) => {
      const e = ensure();
      clearTimeout(fadeTimer.current);
      const list = tracks ?? latest.current.sounds.tracks;
      if (tracks) update("sounds", { tracks });
      if (!list.length) return toast("Add a sound to play first.");
      sync(list);

      if (!latest.current.playing) {
        e.master.gain.cancelScheduledValues(0);
        e.master.gain.value = 0;
      }
      // Both calls start synchronously so they count as part of the click.
      const resumed = e.ctx.resume();
      const decks = [...e.decks.values()];
      const results = await Promise.allSettled(decks.map((d) => d.el.play()));
      await Promise.race([resumed, new Promise((r) => setTimeout(r, 500))]);
      const refused =
        e.ctx.state !== "running" ||
        results.some((r) => r.status === "rejected" && r.reason?.name === "NotAllowedError");
      if (refused || results.every((r) => r.status === "rejected")) {
        if (latest.current.playing) return;
        decks.forEach((d) => d.el.pause());
        if (refused) setBlocked({ tracks: list, fadeIn, stopAfter });
        else toast("Couldn't play those sounds.");
        return;
      }
      ramp(e.ctx, e.master.gain, 1, fadeIn);
      setBlocked(null);
      setPlaying(true);
      setStopAt(stopAfter ? Date.now() + stopAfter * 60000 : null);
    },
    [ensure, sync, update, toast],
  );

  const pause = useCallback(
    (fadeOut = 0.4) => {
      setPlaying(false);
      setStopAt(null);
      setBlocked(null);
      removals.current = [];
      const e = engine.current;
      if (!e) return;
      ramp(e.ctx, e.master.gain, 0, fadeOut);
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(
        () => {
          e.decks.forEach((d) => d.el.pause());
          remember();
        },
        fadeOut * 1000 + 50,
      );
    },
    [remember],
  );

  // A schedule joins whatever is already playing: its sounds fade in, or move
  // to the schedule's volume if they're already on, and everything else
  // carries on. With nothing playing it simply starts its own sounds.
  const runSchedule = useCallback(
    (s) => {
      const fadeIn = s.fadeIn ?? 0;
      const stopAfter = s.duration ?? 0;
      const { playing, sounds } = latest.current;
      if (!playing) return play({ tracks: s.tracks, fadeIn, stopAfter });

      const current = sounds.tracks;
      const on = new Set(current.map((t) => t.id));
      const levels = new Map(s.tracks.map((t) => [t.id, t]));
      const added = s.tracks.filter((t) => !on.has(t.id));
      const tracks = [...current.map((t) => levels.get(t.id) ?? t), ...added];
      sync(tracks, fadeIn);
      update("sounds", { tracks });
      // "Stop after" only stops what this schedule started.
      if (stopAfter && added.length) {
        removals.current.push({ at: Date.now() + stopAfter * 60000, ids: added.map((t) => t.id) });
      }
    },
    [play, sync, update],
  );

  // Adding, removing or re-levelling a sound takes effect right away.
  const tracks = sounds?.tracks;
  useEffect(() => {
    if (!tracks) return;
    sync(tracks);
    if (latest.current.playing && !tracks.length) pause();
  }, [tracks, sync, pause]);

  // Checks schedules and the sleep timer, first as soon as settings load.
  // Coarse polling is fine: browsers throttle background timers anyway, and a
  // tab playing audio isn't throttled.
  const ready = Boolean(sounds);
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const { sounds, playing, stopAt } = latest.current;
      if (!sounds) return;
      if (playing) {
        remember();
        if (stopAt && Date.now() >= stopAt) pause(8);
        const ending = removals.current.filter((r) => Date.now() >= r.at);
        if (ending.length) {
          removals.current = removals.current.filter((r) => !ending.includes(r));
          const ids = new Set(ending.flatMap((r) => r.ids));
          const tracks = sounds.tracks.filter((t) => !ids.has(t.id));
          sync(tracks, 8);
          update("sounds", { tracks });
        }
      }
      const fired = readJson(FIRED_KEY);
      const due = dueSchedule(sounds.schedules, new Date(), fired);
      if (!due) return;
      // Recorded first so another open tab doesn't start it a second time.
      writeJson(FIRED_KEY, { ...fired, [due.s.id]: due.key });
      runSchedule(due.s);
    };
    tick();
    const id = setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", remember);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pagehide", remember);
    };
  }, [ready, runSchedule, pause, remember, sync, update]);

  // Hardware media keys and the OS "now playing" controls.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !engine.current || !tracks) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tracks.map((t) => soundTitle(t.id)).join(" + "),
      artist: "Home Dash",
    });
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", () => pause());
  }, [playing, tracks, play, pause]);

  useEffect(
    () => () => {
      engine.current?.decks.forEach((d) => d.el.pause());
      engine.current?.ctx.close();
      engine.current = null;
    },
    [],
  );

  return useMemo(
    () => ({
      playing,
      blocked,
      stopAt,
      play,
      pause,
      toggle: () => (playing ? pause() : play()),
      setSleep: (minutes) => setStopAt(minutes ? Date.now() + minutes * 60000 : null),
      dismissBlocked: () => setBlocked(null),
    }),
    [playing, blocked, stopAt, play, pause],
  );
}

// Browsers refuse to start sound on a page nobody has touched yet. When a
// schedule hits that, this asks for the one tap it needs.
export function SoundPrompt() {
  const sound = useSound();
  if (!sound?.blocked) return null;
  const names = sound.blocked.tracks.map((t) => soundTitle(t.id)).join(" + ");
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] panel pop-in rounded-2xl p-2 pl-4 flex items-center gap-3 shadow-2xl max-w-[calc(100vw-2rem)]">
      <Volume2 size={18} className="shrink-0 text-accent" />
      <div className="min-w-0 text-sm">
        <div className="font-medium truncate">Ready to play {names}</div>
        <div className="text-xs text-fg-3">Your browser needs a tap before it plays sound.</div>
      </div>
      <Button variant="primary" onClick={() => sound.play(sound.blocked)}>
        <Play size={15} /> Play
      </Button>
      <IconButton label="Dismiss" onClick={sound.dismissBlocked}>
        <X size={16} />
      </IconButton>
    </div>
  );
}
