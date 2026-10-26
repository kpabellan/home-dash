"use client";

import { useEffect, useSyncExternalStore } from "react";

// One shared EventSource for every widget showing service health. The server
// pushes each check as it finishes, so there's nothing to poll.
const EMPTY = { data: null, history: {}, error: null, loading: true };

const store = { snapshot: EMPTY, listeners: new Set(), source: null, subs: 0 };

function emit(patch) {
  store.snapshot = { ...store.snapshot, ...patch };
  store.listeners.forEach((l) => l());
}

function connect() {
  const source = new EventSource("/api/status/stream");
  store.source = source;

  source.addEventListener("snapshot", (e) => {
    const { services, history } = JSON.parse(e.data);
    // Right after the server starts there's nothing yet; keep showing "Checking…".
    emit({ data: Object.keys(services).length ? { services } : null, history, error: null, loading: false });
  });

  source.addEventListener("update", (e) => {
    const { id, result } = JSON.parse(e.data);
    const { data, history } = store.snapshot;
    emit({
      data: { services: { ...data?.services, [id]: result } },
      history: { ...history, [id]: [...(history[id] ?? []), result].slice(-30) },
      error: null,
      loading: false,
    });
  });

  // EventSource retries by itself after a dropped connection; keep showing the
  // last known results meanwhile. It gives up for good on an error response
  // (e.g. a proxy's 502 while Home Dash restarts), so then reconnect manually.
  source.onerror = () => {
    emit({ error: "Reconnecting to Home Dash…", loading: false });
    if (source.readyState !== EventSource.CLOSED) return;
    store.source = null;
    setTimeout(() => store.subs > 0 && !store.source && connect(), 5000);
  };
}

export function useStatusStream(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    store.subs++;
    if (!store.source) connect();
    return () => {
      store.subs--;
      if (store.subs === 0) {
        store.source?.close();
        store.source = null;
      }
    };
  }, [enabled]);

  return useSyncExternalStore(
    (cb) => {
      store.listeners.add(cb);
      return () => store.listeners.delete(cb);
    },
    () => store.snapshot,
    () => EMPTY,
  );
}
