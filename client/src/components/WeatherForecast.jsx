import { useEffect, useState } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, LoaderCircle, LocateFixed, Sun } from "lucide-react";

const ranges = [[1, "Aujourd’hui"], [3, "3 jours"], [7, "7 jours"]];

function condition(code) {
  if (code === 0) return ["Ensoleillé", Sun];
  if ([1, 2, 3].includes(code)) return ["Nuageux", Cloud];
  if ([45, 48].includes(code)) return ["Brouillard", CloudFog];
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Pluie", CloudRain];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Neige", CloudSnow];
  if ([95, 96, 99].includes(code)) return ["Orage", CloudLightning];
  return ["Variable", Cloud];
}

export default function WeatherForecast() {
  const [range, setRange] = useState(1);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");

    if (!navigator.geolocation) {
      setError("La géolocalisation n’est pas disponible dans ce navigateur.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const params = new URLSearchParams({
          latitude: coords.latitude.toFixed(4),
          longitude: coords.longitude.toFixed(4),
          current: "temperature_2m,apparent_temperature,weather_code",
          hourly: "temperature_2m,apparent_temperature,precipitation_probability,weather_code",
          daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
          timezone: "auto",
          forecast_days: "7",
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!response.ok) throw new Error("Prévisions indisponibles");
        setWeather(await response.json());
      } catch (err) {
        setError(err.message || "Impossible de charger la météo.");
      } finally {
        setLoading(false);
      }
    }, () => {
      setError("Autorisez votre position pour afficher la météo locale.");
      setLoading(false);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 });
  }, [requestId]);

  const days = weather?.daily?.time?.slice(0, range).map((date, index) => ({
    date,
    code: weather.daily.weather_code[index],
    max: Math.round(weather.daily.temperature_2m_max[index]),
    min: Math.round(weather.daily.temperature_2m_min[index]),
    rain: weather.daily.precipitation_probability_max[index],
  })) || [];
  const todayHours = weather?.hourly?.time?.map((time, index) => ({
    time,
    hour: `${time.slice(11, 13)}h`,
    temperature: Math.round(weather.hourly.temperature_2m[index]),
    apparent: Math.round(weather.hourly.apparent_temperature[index]),
    rain: weather.hourly.precipitation_probability[index],
    code: weather.hourly.weather_code[index],
  })).filter(value => value.time.startsWith(weather.daily.time[0])) || [];
  const minimumHour = todayHours.reduce((minimum, value) => !minimum || value.temperature < minimum.temperature ? value : minimum, null);
  const maximumHour = todayHours.reduce((maximum, value) => !maximum || value.temperature > maximum.temperature ? value : maximum, null);
  const hourlyHighlights = todayHours.filter((_, index) => index % 3 === 0).slice(2, 8);

  return <section className="weather-panel">
    <header className="weather-header">
      <h2>Météo locale</h2>
      <div className="weather-ranges" aria-label="Période des prévisions">{ranges.map(([value, label]) => <button type="button" key={value} className={range === value ? "active" : ""} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}</div>
    </header>

    {loading && <div className="weather-message" role="status"><LoaderCircle className="spin" size={20}/> Localisation et météo…</div>}
    {!loading && error && <div className="weather-message weather-error"><LocateFixed size={20}/><span>{error}</span><button type="button" onClick={() => setRequestId(value => value + 1)}>Réessayer</button></div>}
    {!loading && weather && <>
      <div className="weather-current"><strong>{Math.round(weather.current.temperature_2m)}°</strong><div><b>{condition(weather.current.weather_code)[0]}</b><span>Ressenti {Math.round(weather.current.apparent_temperature)}°</span></div></div>
      {range === 1 && <div className="weather-today-details">
        <div className="weather-extremes"><span><small>Minimum</small><b>{minimumHour?.temperature}°</b><em>à {minimumHour?.hour}</em></span><span><small>Maximum</small><b>{maximumHour?.temperature}°</b><em>à {maximumHour?.hour}</em></span></div>
        <div className="weather-hourly" aria-label="Températures heure par heure">{hourlyHighlights.map(hour => { const Icon = condition(hour.code)[1]; return <span key={hour.time}><small>{hour.hour}</small><Icon size={16}/><b>{hour.temperature}°</b><em>{hour.rain}%</em></span>; })}</div>
      </div>}
      {range > 1 && <div className={`weather-days range-${range}`}>{days.map((day, index) => {
        const [label, Icon] = condition(day.code);
        const dateLabel = index === 0 ? "Aujourd’hui" : new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(new Date(`${day.date}T12:00:00`));
        return <article key={day.date}><span>{dateLabel}</span><Icon size={25}/><b>{day.max}° <small>{day.min}°</small></b><em>{label} · {day.rain}% pluie</em></article>;
      })}</div>}
    </>}
  </section>;
}
