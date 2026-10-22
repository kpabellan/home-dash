import fs from "fs";
import path from "path";

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// Reads src/data/services.json (falls back to services.example.json) and
// normalizes every entry so the client can rely on `id` and `group`.
export function loadServices() {
  const dataDir = path.join(process.cwd(), "src/data");
  const raw =
    readJson(path.join(dataDir, "services.json")) ?? readJson(path.join(dataDir, "services.example.json")) ?? [];

  const seen = new Set();
  return raw.map((service) => {
    let id = slugify(service.id ?? service.name);
    while (seen.has(id)) id += "-x";
    seen.add(id);

    return {
      id,
      name: service.name,
      url: service.url,
      icon: service.icon ?? null,
      description: service.description ?? "",
      private: Boolean(service.private),
      group: service.group ?? (service.private ? "private" : "public"),
    };
  });
}
