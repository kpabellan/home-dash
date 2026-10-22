import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";

const SUN = "#fbbf24";
const MOON = "#a5b4fc";
const RAIN = "#60a5fa";
const SNOW = "#7dd3fc";
const STORM = "#a78bfa";
const CLOUD = "var(--text-2)";

// WMO weather interpretation codes, as returned by Open-Meteo.
export function describeWeather(code, isDay = true) {
  if (code === 0) return { label: "Clear", Icon: isDay ? Sun : Moon, color: isDay ? SUN : MOON };
  if (code === 1) return { label: "Mostly clear", Icon: isDay ? Sun : Moon, color: isDay ? SUN : MOON };
  if (code === 2) return { label: "Partly cloudy", Icon: isDay ? CloudSun : CloudMoon, color: isDay ? SUN : MOON };
  if (code === 3) return { label: "Overcast", Icon: Cloud, color: CLOUD };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog, color: CLOUD };
  if (code >= 51 && code <= 57) return { label: "Drizzle", Icon: CloudDrizzle, color: RAIN };
  if (code >= 61 && code <= 67) return { label: code >= 66 ? "Freezing rain" : "Rain", Icon: CloudRain, color: RAIN };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow, color: SNOW };
  if (code >= 80 && code <= 82) return { label: "Showers", Icon: CloudRain, color: RAIN };
  if (code === 85 || code === 86) return { label: "Snow showers", Icon: CloudSnow, color: SNOW };
  if (code === 95) return { label: "Thunderstorm", Icon: CloudLightning, color: STORM };
  if (code === 96 || code === 99) return { label: "Hailstorm", Icon: CloudHail, color: STORM };
  return { label: "Unknown", Icon: Cloud, color: CLOUD };
}
