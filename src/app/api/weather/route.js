export const dynamic = "force-dynamic";

// Uses Open-Meteo (free, no API key). Location comes from the query string
// (set in Settings) and falls back to the env vars from the original setup.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat") || process.env.WEATHER_LATITUDE || process.env.OPENWEATHER_LATITUDE;
  const lon = searchParams.get("lon") || process.env.WEATHER_LONGITUDE || process.env.OPENWEATHER_LONGITUDE;
  const metric = searchParams.get("units") === "metric";

  if (!lat || !lon || isNaN(Number(lat)) || isNaN(Number(lon))) {
    return Response.json({ error: "no-location" }, { status: 400 });
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    temperature_unit: metric ? "celsius" : "fahrenheit",
    wind_speed_unit: metric ? "kmh" : "mph",
    timezone: "auto",
    forecast_days: "7",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    // Hourly data starts at local midnight; skip ahead to the current hour.
    const nowIdx = Math.max(
      0,
      d.hourly.time.findIndex((t) => t >= d.current.time.slice(0, 13)),
    );
    const hourly = d.hourly.time.slice(nowIdx, nowIdx + 24).map((time, i) => ({
      time,
      // The hour as an instant, so the browser can roll past it between fetches.
      at: Date.parse(`${time}:00Z`) - d.utc_offset_seconds * 1000,
      temp: d.hourly.temperature_2m[nowIdx + i],
      code: d.hourly.weather_code[nowIdx + i],
      pop: d.hourly.precipitation_probability?.[nowIdx + i] ?? null,
      isDay: d.hourly.is_day?.[nowIdx + i] === 1,
    }));

    const daily = d.daily.time.map((date, i) => ({
      date,
      code: d.daily.weather_code[i],
      max: d.daily.temperature_2m_max[i],
      min: d.daily.temperature_2m_min[i],
      pop: d.daily.precipitation_probability_max?.[i] ?? null,
      sunrise: d.daily.sunrise[i],
      sunset: d.daily.sunset[i],
    }));

    return Response.json({
      units: metric ? "metric" : "imperial",
      current: {
        temp: d.current.temperature_2m,
        feelsLike: d.current.apparent_temperature,
        humidity: d.current.relative_humidity_2m,
        wind: d.current.wind_speed_10m,
        code: d.current.weather_code,
        isDay: d.current.is_day === 1,
        precipitation: d.current.precipitation,
      },
      hourly,
      daily,
    });
  } catch {
    return Response.json({ error: "fetch-failed" }, { status: 502 });
  }
}
