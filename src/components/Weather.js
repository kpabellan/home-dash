"use client";

import { useEffect, useState } from "react";

export default function Weather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch("/api/weather");
        const data = await res.json();
        setWeather({
          temp: data.temp,
          iconUrl: `https://openweathermap.org/img/wn/${data.icon}@2x.png`,
          desc: data.desc,
        });
      } catch (error) {
        console.error("Failed to fetch weather:", error);
      }
    };

    fetchWeather();
  }, []);

  if (!weather) return null;

  return (
    <div className="text-white text-right">
      <div className="flex items-center space-x-2">
        <img src={weather.iconUrl} alt={weather.desc} className="w-10 h-10" />
        <div className="text-3xl">{Math.round(weather.temp)}°F</div>
      </div>
      <div className="text-sm capitalize">{weather.desc}</div>
    </div>
  );
}
