import dns from "dns";

// Node doesn't cache DNS, so every health check and Proxmox request would
// otherwise look its hostname up again. Local resolvers such as AdGuard Home
// rate-limit clients, which made healthy services time out. Answers are kept
// for a few minutes, and a stale answer is used if a refresh fails.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

// Drop-in replacement for dns.lookup, for the `lookup` option of http(s).request.
export function cachedLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const family = typeof options === "number" ? options : options?.family;

  const reply = (addresses) => {
    const matches = family ? addresses.filter((a) => a.family === family) : addresses;
    if (!matches.length) {
      const err = new Error(`No ${family ? `IPv${family} ` : ""}address for ${hostname}`);
      err.code = "ENOTFOUND";
      return callback(err);
    }
    if (options?.all) callback(null, matches);
    else callback(null, matches[0].address, matches[0].family);
  };

  const hit = cache.get(hostname);
  if (hit && Date.now() - hit.at < TTL_MS) return reply(hit.addresses);

  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return hit ? reply(hit.addresses) : callback(err);
    cache.set(hostname, { at: Date.now(), addresses });
    reply(addresses);
  });
}
