export async function GET(req) {
  const lat = process.env.OPENWEATHER_LATITUDE
  const lon = process.env.OPENWEATHER_LONGITUDE
  const apiKey = process.env.OPENWEATHER_API_KEY;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    return new Response(
      JSON.stringify({
        temp: data.main.temp,
        icon: data.weather[0].icon,
        desc: data.weather[0].description,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch weather" }), {
      status: 500,
    });
  }
}