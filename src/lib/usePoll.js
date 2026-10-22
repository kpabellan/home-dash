"use client";

import { useEffect, useSyncExternalStore } from "react";

// A tiny shared polling store: every component asking for the same URL shares
// one timer, one request and one history buffer.
const stores = new Map();

function getStore(url) {
  let store = stores.get(url);
  if (!store) {
    store = {
      listeners: new Set(),
      snapshot: { data: null, error: null, loading: true, updatedAt: 0, history: [] },
      timer: null,
      interval: 5000,
      historySize: 0,
      inflight: false,
      subs: 0,
    };
    stores.set(url, store);
  }
  return store;
}

function emit(store, patch) {
  store.snapshot = { ...store.snapshot, ...patch };
  store.listeners.forEach((l) => l());
}

async function tick(url, store) {
  if (store.inflight) return;
  if (typeof document !== "undefined" && document.hidden && store.snapshot.updatedAt) return;
  store.inflight = true;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data?.error ?? `HTTP ${res.status}`), { data });
    const history = store.historySize
      ? [...store.snapshot.history, { t: Date.now(), data }].slice(-store.historySize)
      : store.snapshot.history;
    emit(store, { data, error: null, loading: false, updatedAt: Date.now(), history });
  } catch (error) {
    emit(store, { error: error.message ?? "Request failed", loading: false });
  } finally {
    store.inflight = false;
  }
}

function schedule(url, store) {
  clearInterval(store.timer);
  store.timer = setInterval(() => tick(url, store), store.interval);
}

export function usePoll(url, { interval = 5000, historySize = 0, enabled = true } = {}) {
  const store = url ? getStore(url) : null;

  useEffect(() => {
    if (!store || !enabled) return;
    store.historySize = Math.max(store.historySize, historySize);
    const changed = store.interval !== interval;
    store.interval = interval;

    const first = store.subs === 0;
    const onVisible = () => !document.hidden && tick(url, store);
    store.subs++;

    if (first || changed) {
      schedule(url, store);
      if (first && Date.now() - store.snapshot.updatedAt > interval) tick(url, store);
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      store.subs--;
      document.removeEventListener("visibilitychange", onVisible);
      if (store.subs === 0) {
        clearInterval(store.timer);
        store.timer = null;
      }
    };
  }, [url, store, interval, historySize, enabled]);

  return useSyncExternalStore(
    (cb) => {
      if (!store) return () => {};
      store.listeners.add(cb);
      return () => store.listeners.delete(cb);
    },
    () => store?.snapshot ?? EMPTY,
    () => EMPTY,
  );
}

const EMPTY = { data: null, error: null, loading: true, updatedAt: 0, history: [] };

export function refreshPoll(url) {
  const store = stores.get(url);
  if (store) tick(url, store);
}
