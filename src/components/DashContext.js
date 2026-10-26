"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePoll } from "@/lib/usePoll";
import { useStatusStream } from "@/lib/useStatusStream";

export const DashContext = createContext(null);

export function useDash() {
  return useContext(DashContext);
}

// `enabled` lets a widget skip a source it isn't showing, so it isn't polled.
export function useSystem(enabled = true) {
  const { settings } = useDash();
  return usePoll(enabled ? "/api/system" : null, {
    interval: settings.general.systemInterval * 1000,
    historySize: 60,
  });
}

// { data: { services: { id: result } }, history: { id: [result, …] }, error }
export function useStatus() {
  const { services } = useDash();
  return useStatusStream(services.length > 0);
}

export function useProxmox(enabled = true) {
  const { settings } = useDash();
  return usePoll(enabled ? "/api/proxmox" : null, {
    interval: settings.general.proxmoxInterval * 1000,
  });
}

export function useWeather() {
  const { settings } = useDash();
  const { location, units } = settings.weather;
  const params = new URLSearchParams({ units });
  if (location) {
    params.set("lat", location.lat);
    params.set("lon", location.lon);
  }
  return usePoll(`/api/weather?${params}`, { interval: settings.general.weatherInterval * 1000 });
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
