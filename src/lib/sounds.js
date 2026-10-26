import fs from "fs";
import path from "path";
import { soundTitle } from "./format";

export const AUDIO_TYPES = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
};

// SOUNDS_DIR overrides where audio files live; mount it as a volume in Docker.
export function soundsDir() {
  return path.resolve(process.env.SOUNDS_DIR || path.join(process.cwd(), "data", "sounds"));
}

// Resolves a file name inside the sounds folder, or null for anything that
// isn't a plain audio file name (no folders, no hidden or partial uploads).
export function soundPath(name) {
  if (typeof name !== "string" || !name || name.length > 200) return null;
  if (/[\\/\0]/.test(name) || name.startsWith(".")) return null;
  if (!AUDIO_TYPES[path.extname(name).toLowerCase()]) return null;
  return path.join(soundsDir(), name);
}

export function soundType(file) {
  return AUDIO_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export async function listSounds() {
  const dir = soundsDir();
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const sounds = await Promise.all(
    entries
      .filter((e) => e.isFile() && soundPath(e.name))
      .map(async (e) => {
        const stat = await fs.promises.stat(path.join(dir, e.name));
        return { id: e.name, name: soundTitle(e.name), size: stat.size };
      }),
  );
  return sounds.sort((a, b) => a.name.localeCompare(b.name));
}
