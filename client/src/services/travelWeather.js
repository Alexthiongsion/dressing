export async function searchLocations(query) {
  if (query.trim().length < 3) return [];
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=fr&format=json`);
  if (!response.ok) throw new Error("Recherche de destination indisponible");
  return (await response.json()).results || [];
}

export async function fetchTravelWeather(travel) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(`${travel.startDate}T00:00:00`);
  const end = new Date(`${travel.endDate}T00:00:00`);
  const daysUntil = Math.ceil((start - today) / 86400000);
  const tripDays = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  const common = `latitude=${travel.latitude}&longitude=${travel.longitude}&timezone=${encodeURIComponent(travel.timezone || "auto")}`;
  let type;
  let url;
  if (daysUntil <= 16) {
    type = "forecast";
    url = `https://api.open-meteo.com/v1/forecast?${common}&start_date=${travel.startDate}&end_date=${travel.endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum`;
  } else {
    type = "seasonal";
    const forecastDays = Math.min(210, Math.max(30, daysUntil + tripDays + 2));
    url = `https://seasonal-api.open-meteo.com/v1/seasonal?${common}&forecast_days=${forecastDays}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error("Tendance météo indisponible pour ces dates");
  const payload = await response.json();
  const valuesFor = key => {
    if (type !== "seasonal") return payload.daily?.[key] || [];
    const series = Object.entries(payload.daily || {}).filter(([name, values]) => (name === key || name.startsWith(`${key}_member`)) && Array.isArray(values)).map(([, values]) => values);
    return (payload.daily?.time || []).map((_, index) => {
      const values = series.map(items => items[index]).filter(Number.isFinite);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });
  };
  const maximums = valuesFor("temperature_2m_max"), minimums = valuesFor("temperature_2m_min"), rainfall = valuesFor("precipitation_sum");
  const daily = (payload.daily?.time || []).map((date, index) => ({
    date,
    code: payload.daily.weather_code?.[index],
    max: Math.round(maximums[index]),
    min: Math.round(minimums[index]),
    rainProbability: payload.daily.precipitation_probability_max?.[index] ?? null,
    rain: Math.round((rainfall[index] || 0) * 10) / 10,
  })).filter(day => day.date >= travel.startDate && day.date <= travel.endDate);
  if (!daily.length) throw new Error("Aucune donnée météo disponible pour ce séjour");
  return { type, updatedAt: new Date().toISOString(), daily };
}

export async function fetchItineraryWeather(travel) {
  const destinations = travel?.destinations?.length ? travel.destinations : [travel];
  const locations = await Promise.all(destinations.map(async destination => ({
    destination: destination.destination,
    ...(await fetchTravelWeather(destination)),
  })));
  return {
    type: locations.some(location => location.type === "seasonal") ? "seasonal" : "forecast",
    updatedAt: new Date().toISOString(),
    locations,
    daily: locations.flatMap(location => location.daily),
  };
}

export function summarizeTravelWeather(weather) {
  const days = weather?.daily || [];
  if (!days.length) return null;
  return {
    min: Math.min(...days.map(day => day.min)),
    max: Math.max(...days.map(day => day.max)),
    rainDays: days.filter(day => day.rain > 1 || day.rainProbability >= 50).length,
  };
}
