import os from "os";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

export const dynamic = "force-dynamic";

// ---- CPU -----------------------------------------------------------------

function cpuTimes() {
  return os.cpus().map((c) => {
    const t = c.times;
    return { idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq };
  });
}

let lastCpu = null;

async function cpuUsage() {
  let prev = lastCpu;
  if (!prev || Date.now() - prev.at > 30000) {
    prev = { at: Date.now(), times: cpuTimes() };
    await new Promise((r) => setTimeout(r, 250));
  }
  const now = cpuTimes();
  lastCpu = { at: Date.now(), times: now };

  let idle = 0;
  let total = 0;
  now.forEach((c, i) => {
    const p = prev.times[i] ?? { idle: 0, total: 0 };
    idle += c.idle - p.idle;
    total += c.total - p.total;
  });
  return total > 0 ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : 0;
}

function cpuTemp() {
  if (process.platform !== "linux") return null;
  try {
    const zones = fs.readdirSync("/sys/class/thermal").filter((z) => z.startsWith("thermal_zone"));
    for (const zone of zones) {
      const raw = fs.readFileSync(`/sys/class/thermal/${zone}/temp`, "utf8");
      const value = parseInt(raw, 10) / 1000;
      if (value > 0 && value < 150) return value;
    }
  } catch {}
  return null;
}

// ---- Disks ---------------------------------------------------------------

// DISK_PATHS="/,/mnt/nas" (optionally "Label=/path") picks which mounts to
// report; defaults to the drive the app runs from.
function diskTargets() {
  const env = process.env.DISK_PATHS;
  if (env) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [label, p] = entry.includes("=") ? entry.split("=") : [entry, entry];
        return { label, path: p };
      });
  }
  const root = path.parse(process.cwd()).root;
  return [{ label: root.replace(/\\$/, "") || "/", path: root }];
}

function disks() {
  if (typeof fs.statfsSync !== "function") return [];
  return diskTargets()
    .map(({ label, path: p }) => {
      try {
        const s = fs.statfsSync(p);
        const total = s.blocks * s.bsize;
        const free = s.bavail * s.bsize;
        return { label, path: p, total, used: total - free };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---- Network -------------------------------------------------------------

function readLinuxCounters() {
  const text = fs.readFileSync("/proc/net/dev", "utf8");
  let rx = 0;
  let tx = 0;
  for (const line of text.split("\n").slice(2)) {
    const [iface, rest] = line.split(":");
    if (!rest || iface.trim() === "lo") continue;
    const cols = rest.trim().split(/\s+/).map(Number);
    rx += cols[0];
    tx += cols[8];
  }
  return { rx, tx };
}

function readWindowsCounters() {
  return new Promise((resolve) => {
    execFile("netstat", ["-e"], { timeout: 3000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const line = stdout.split(/\r?\n/).find((l) => /^\s*Bytes/i.test(l));
      const nums = line?.match(/\d+/g);
      resolve(nums?.length >= 2 ? { rx: Number(nums[0]), tx: Number(nums[1]) } : null);
    });
  });
}

let lastNet = null;

async function network() {
  let counters = null;
  try {
    if (process.platform === "linux") counters = readLinuxCounters();
    else if (process.platform === "win32") counters = await readWindowsCounters();
  } catch {
    counters = null;
  }
  if (!counters) return null;

  const now = Date.now();
  const prev = lastNet;
  lastNet = { at: now, ...counters };
  if (!prev || now - prev.at > 60000) {
    return { rxRate: 0, txRate: 0, rxTotal: counters.rx, txTotal: counters.tx, warmup: true };
  }
  const secs = (now - prev.at) / 1000 || 1;
  return {
    rxRate: Math.max(0, (counters.rx - prev.rx) / secs),
    txRate: Math.max(0, (counters.tx - prev.tx) / secs),
    rxTotal: counters.rx,
    txTotal: counters.tx,
  };
}

// ---- Handler -------------------------------------------------------------

export async function GET() {
  const [usage, net] = await Promise.all([cpuUsage(), network()]);
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();

  return Response.json({
    at: Date.now(),
    hostname: os.hostname(),
    platform: process.platform,
    release: os.release(),
    arch: os.arch(),
    uptime: os.uptime(),
    cpu: {
      usage,
      cores: cpus.length,
      model: cpus[0]?.model?.replace(/\s+/g, " ").trim() ?? "Unknown CPU",
      load: process.platform === "win32" ? null : os.loadavg(),
      temp: cpuTemp(),
    },
    memory: { total, used: total - free },
    disks: disks(),
    network: net,
  });
}
