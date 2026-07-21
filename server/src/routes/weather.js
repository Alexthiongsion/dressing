import express from "express";

const router = express.Router();
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const requestWeather = async url => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(payload.daily?.time) && payload.daily.time.length) return payload;
      if (response.ok) {
        lastError = new Error("Aucune donnée météo disponible pour ce séjour");
        continue;
      }
      lastError = new Error(payload.reason || "Tendance météo indisponible pour ces dates");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

router.post("/travel", async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const { startDate, endDate } = req.body;
  const timezone = typeof req.body.timezone === "string" ? req.body.timezone : "auto";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !isoDate.test(startDate || "") || !isoDate.test(endDate || "") || endDate < startDate) {
    return res.status(400).json({ message: "Séjour météo invalide" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const daysUntil = Math.ceil((start - today) / 86400000);
  const daysUntilEnd = Math.ceil((end - today) / 86400000);
  const tripDays = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  const common = `latitude=${latitude}&longitude=${longitude}&timezone=${encodeURIComponent(timezone || "auto")}`;
  let type;
  let url;
  let fallbackUrl;

  if (end < today) {
    type = "historical";
    url = `https://archive-api.open-meteo.com/v1/archive?${common}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`;
    // Les archives consolidées peuvent répondre avec retard ou échouer ponctuellement.
    // Le modèle de prévision historique couvre les séjours récents et évite de
    // perdre une destination entière dans un itinéraire multi-étapes.
    fallbackUrl = `https://historical-forecast-api.open-meteo.com/v1/forecast?${common}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`;
  } else if (daysUntilEnd <= 16) {
    type = "forecast";
    url = `https://api.open-meteo.com/v1/forecast?${common}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum`;
  } else {
    type = "seasonal";
    const forecastDays = Math.min(210, Math.max(30, daysUntil + tripDays + 2));
    url = `https://seasonal-api.open-meteo.com/v1/seasonal?${common}&forecast_days=${forecastDays}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`;
  }

  try {
    let payload;
    try {
      payload = await requestWeather(url);
    } catch (primaryError) {
      if (!fallbackUrl) throw primaryError;
      payload = await requestWeather(fallbackUrl);
    }
    return res.json({ type, payload });
  } catch (error) {
    return res.status(502).json({ message: error.name === "TimeoutError" ? "Le service météo met trop de temps à répondre" : "Tendance météo indisponible pour ces dates" });
  }
});

export default router;
