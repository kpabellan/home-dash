import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { soundPath, soundType, soundsDir } from "@/lib/sounds";

export const dynamic = "force-dynamic";

function fileStream(file, range) {
  return Readable.toWeb(fs.createReadStream(file, range));
}

// Serves the file with byte-range support so the browser can seek and
// resume inside hours-long recordings without downloading all of it.
export async function GET(request, { params }) {
  const file = soundPath((await params).name);
  let stat = null;
  try {
    stat = file && (await fs.promises.stat(file));
  } catch {}
  if (!stat?.isFile()) return Response.json({ error: "Not found" }, { status: 404 });

  const size = stat.size;
  const headers = {
    "Content-Type": soundType(file),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!m || (!m[1] && !m[2])) {
    return new Response(fileStream(file), { headers: { ...headers, "Content-Length": String(size) } });
  }

  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(fileStream(file, { start, end }), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

// Streams the upload to a hidden temp file, then renames it into place so a
// half-finished upload never shows up in the library.
export async function PUT(request, { params }) {
  const file = soundPath((await params).name);
  if (!file) {
    return Response.json({ error: "Use an audio file: mp3, m4a, aac, ogg, opus, webm, wav or flac." }, { status: 400 });
  }
  if (!request.body) return Response.json({ error: "Empty upload" }, { status: 400 });

  const dir = soundsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  if (fs.existsSync(file)) {
    return Response.json({ error: `${path.basename(file)} is already in the library.` }, { status: 409 });
  }

  const tmp = path.join(dir, `.upload-${randomUUID()}`);
  try {
    await pipeline(Readable.fromWeb(request.body), fs.createWriteStream(tmp, { flags: "wx" }));
    await fs.promises.rename(tmp, file);
  } catch (e) {
    await fs.promises.rm(tmp, { force: true });
    return Response.json({ error: `Upload failed: ${e.message}` }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request, { params }) {
  const file = soundPath((await params).name);
  try {
    if (!file) throw new Error();
    await fs.promises.unlink(file);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
