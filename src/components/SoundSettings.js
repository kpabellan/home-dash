"use client";

import { useRef, useState } from "react";
import { FileAudio, ListMusic, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { refreshPoll } from "@/lib/usePoll";
import { formatBytes, uid } from "@/lib/format";
import { soundUrl, useSoundLibrary } from "./SoundEngine";
import { TrackList } from "./widgets/sounds";
import { Button, IconButton, SectionTitle, Select, Toggle, cx, inputClass } from "./ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACCEPT = ".mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.wav,.flac";

const FADE_OPTIONS = [
  { value: "0", label: "Start right away" },
  { value: "10", label: "Fade in over 10 s" },
  { value: "30", label: "Fade in over 30 s" },
  { value: "60", label: "Fade in over 1 min" },
  { value: "120", label: "Fade in over 2 min" },
  { value: "300", label: "Fade in over 5 min" },
];

const DURATION_OPTIONS = [
  { value: "0", label: "Keep playing" },
  { value: "15", label: "Stop after 15 min" },
  { value: "30", label: "Stop after 30 min" },
  { value: "60", label: "Stop after 1 hour" },
  { value: "120", label: "Stop after 2 hours" },
  { value: "240", label: "Stop after 4 hours" },
  { value: "480", label: "Stop after 8 hours" },
];

// XHR rather than fetch because recordings can be hundreds of MB and fetch
// can't report upload progress.
function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", soundUrl(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let message = `Upload failed (HTTP ${xhr.status})`;
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed: the dashboard server couldn't be reached."));
    xhr.send(file);
  });
}

export default function SoundsTab({ settings, update, toast }) {
  const s = settings.sounds;
  const set = (patch) => update("sounds", patch);
  const { data, error } = useSoundLibrary();
  const library = data?.sounds ?? [];
  const fileRef = useRef(null);
  const [uploads, setUploads] = useState([]);

  const upload = async (files) => {
    for (const file of files) {
      const id = uid();
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        await uploadFile(file, (progress) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))));
      } catch (e) {
        toast(e.message);
      }
      setUploads((u) => u.filter((x) => x.id !== id));
      refreshPoll("/api/sounds");
    }
  };

  const remove = async (sound) => {
    if (!window.confirm(`Delete “${sound.name}” from the server?`)) return;
    const res = await fetch(soundUrl(sound.id), { method: "DELETE" }).catch(() => null);
    if (!res?.ok) toast(`Couldn't delete “${sound.name}”.`);
    refreshPoll("/api/sounds");
  };

  const setSchedule = (id, patch) => set({ schedules: s.schedules.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  const addSchedule = () =>
    set({
      schedules: [
        ...s.schedules,
        {
          id: uid(),
          enabled: true,
          time: "07:00",
          days: [1, 2, 3, 4, 5],
          tracks: s.tracks,
          fadeIn: 60,
          duration: 0,
        },
      ],
    });

  return (
    <>
      <section>
        <SectionTitle>Library</SectionTitle>
        <p className="text-sm text-fg-2 mb-3">
          Sounds are stored on the dashboard server and play from there, so they keep working without an internet
          connection.
        </p>
        {error && <p className="text-xs text-[var(--bad)] mb-3">{error}</p>}
        {(library.length > 0 || uploads.length > 0) && (
          <ul className="rounded-xl border border-line divide-y divide-[var(--hairline)] mb-3 overflow-hidden">
            {library.map((sound) => (
              <li key={sound.id} className="flex items-center gap-3 pl-3 pr-1.5 py-1.5">
                <FileAudio size={15} className="shrink-0 text-fg-3" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{sound.name}</div>
                  <div className="text-xs text-fg-3 truncate">
                    {sound.id} · {formatBytes(sound.size)}
                  </div>
                </div>
                <IconButton
                  label={`Delete ${sound.name}`}
                  onClick={() => remove(sound)}
                  className="hover:!text-[var(--bad)]"
                >
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                <Loader2 size={15} className="shrink-0 text-fg-3 animate-spin" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{u.name}</div>
                  <div className="mt-1.5 h-1 rounded-full bg-[var(--track)] overflow-hidden">
                    <div className="h-full bg-accent transition-[width]" style={{ width: `${u.progress * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-fg-3 tabular-nums">{Math.round(u.progress * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Upload audio
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) upload(files);
          }}
        />
        <p className="text-xs text-fg-3 mt-3 leading-relaxed">
          MP3, M4A, AAC, Ogg, Opus, WebM, WAV or FLAC. For big files, copying them straight into the server&apos;s
          sounds folder is faster. The file name becomes the title.
        </p>
      </section>

      <section>
        <SectionTitle>Schedule</SectionTitle>
        <div className="space-y-3">
          {s.schedules.map((sch) => (
            <ScheduleCard
              key={sch.id}
              schedule={sch}
              library={library}
              current={s.tracks}
              onChange={(patch) => setSchedule(sch.id, patch)}
              onRemove={() => set({ schedules: s.schedules.filter((x) => x.id !== sch.id) })}
            />
          ))}
        </div>
        <Button onClick={addSchedule} className={cx(s.schedules.length > 0 && "mt-3")}>
          <Plus size={14} /> Add a schedule
        </Button>
        <p className="text-xs text-fg-3 mt-3 leading-relaxed">
          Schedules run in this browser, so keep the dashboard open in a tab and the device awake. Browsers block sound
          on a page you haven&apos;t clicked since it loaded; when that happens you&apos;ll get a Play button. To skip
          it, allow autoplay for this site in your browser&apos;s site settings.
        </p>
      </section>
    </>
  );
}

function daysSummary(days) {
  const key = [...days].sort((x, y) => x - y).join();
  if (!days.length) return "Pick at least one day";
  if (key === "0,1,2,3,4,5,6") return "Every day";
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "0,6") return "Weekends";
  return [...days]
    .sort((x, y) => x - y)
    .map((d) => DAY_NAMES[d].slice(0, 3))
    .join(", ");
}

function ScheduleCard({ schedule: sch, library, current, onChange, onRemove }) {
  const toggleDay = (d) =>
    onChange({ days: sch.days.includes(d) ? sch.days.filter((x) => x !== d) : [...sch.days, d].sort((x, y) => x - y) });
  const tracks = sch.tracks ?? [];

  return (
    <div className={cx("rounded-2xl border border-line p-3.5 space-y-3.5 transition", !sch.enabled && "opacity-60")}>
      <div className="flex items-center gap-3">
        <div className="w-40 shrink-0">
          <input
            type="time"
            value={sch.time}
            onChange={(e) => e.target.value && onChange({ time: e.target.value })}
            aria-label="Start time"
            className={cx(inputClass, "h-11 text-lg font-semibold tabular-nums")}
          />
        </div>
        <div className="flex-1 min-w-0 text-xs text-fg-3 truncate">{daysSummary(sch.days)}</div>
        <Toggle checked={sch.enabled} onChange={(enabled) => onChange({ enabled })} label="Schedule on" />
        <IconButton label="Delete schedule" onClick={onRemove} className="-mr-1 hover:!text-[var(--bad)]">
          <Trash2 size={15} />
        </IconButton>
      </div>
      <div className="flex gap-1">
        {DAYS.map((label, d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggleDay(d)}
            aria-pressed={sch.days.includes(d)}
            aria-label={DAY_NAMES[d]}
            title={DAY_NAMES[d]}
            className={cx(
              "flex-1 h-8 rounded-lg text-xs font-medium transition",
              sch.days.includes(d) ? "bg-accent/20 text-fg" : "bg-[var(--input)] text-fg-3 hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Sounds</span>
          {current.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ tracks: current })}
              className="inline-flex items-center gap-1 text-xs text-fg-2 hover:text-fg transition"
            >
              <ListMusic size={13} /> Use what&apos;s in the tile
            </button>
          )}
        </div>
        <TrackList tracks={tracks} onChange={(tracks) => onChange({ tracks })} library={library} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={String(sch.fadeIn ?? 0)}
          onChange={(v) => onChange({ fadeIn: Number(v) })}
          options={FADE_OPTIONS}
          className="h-9 text-[13px]"
        />
        <Select
          value={String(sch.duration ?? 0)}
          onChange={(v) => onChange({ duration: Number(v) })}
          options={DURATION_OPTIONS}
          className="h-9 text-[13px]"
        />
      </div>
    </div>
  );
}
