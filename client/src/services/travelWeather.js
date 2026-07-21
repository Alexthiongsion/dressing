import { api } from "./api";

export async function searchLocations(query, signal) {
  if (query.trim().length < 3) return [];
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=fr&format=json`, { signal });
  if (!response.ok) throw new Error("Recherche de destination indisponible");
  return (await response.json()).results || [];
}

export async function fetchTravelWeather(travel) {
  // Le serveur peut basculer de l'archive consolidée vers la prévision
  // historique. Laisser assez de temps à ce repli évite qu'une seule étape
  // soit marquée indisponible alors que sa météo est bien récupérable.
  const { type, payload } = await api("/weather/travel", { method: "POST", body: JSON.stringify(travel), timeout: 45000 });
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

function estimateTravelWeather(travel) {
  const northernMaximums = [5, 7, 11, 16, 20, 24, 27, 27, 22, 16, 10, 6];
  const northernMinimums = [0, 1, 3, 6, 10, 14, 16, 16, 12, 8, 4, 1];
  const start = new Date(`${travel.startDate}T12:00:00Z`);
  const end = new Date(`${travel.endDate}T12:00:00Z`);
  const southernHemisphere = Number(travel.latitude) < 0;
  const daily = [];
  for (let cursor = start, index = 0; cursor <= end; cursor = new Date(cursor.getTime() + 86400000), index += 1) {
    const month = (cursor.getUTCMonth() + (southernHemisphere ? 6 : 0)) % 12;
    const variation = [-1, 0, 1, 0][index % 4];
    daily.push({
      date: cursor.toISOString().slice(0, 10),
      max: northernMaximums[month] + variation,
      min: northernMinimums[month] + variation,
      rainProbability: index % 4 === 2 ? 55 : 25,
      rain: index % 4 === 2 ? 2 : 0,
      estimated: true,
    });
  }
  return { type: "estimated", updatedAt: new Date().toISOString(), daily };
}

export async function fetchItineraryWeather(travel) {
  const destinations = travel?.destinations?.length ? travel.destinations : [travel];
  const results = await Promise.allSettled(destinations.map(async destination => ({
    destination: destination.destination,
    ...(await fetchTravelWeather(destination)),
  })));
  const estimatedDestinations = [];
  const locations = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const destination = destinations[index];
    estimatedDestinations.push(destination.destination);
    return { destination: destination.destination, ...estimateTravelWeather(destination) };
  });
  return {
    type: locations.every(location => location.type === "historical") ? "historical" : locations.some(location => location.type === "seasonal" || location.type === "estimated") ? "seasonal" : "forecast",
    updatedAt: new Date().toISOString(),
    locations,
    daily: locations.flatMap(location => location.daily),
    unavailableDestinations: [],
    estimatedDestinations,
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
