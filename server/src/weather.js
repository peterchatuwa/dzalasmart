import { ALERT_DISTRICTS, DISTRICT_COORDS, regionForDistrict } from "./places.js";
import { HttpError } from "./util.js";

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

export const MARKET = [
  {
    crop: "Irish potato",
    price: "MWK 900/kg",
    trend: "down",
    trendLabel: "↘ -3.6%",
    yieldKg: "12,000 kg",
    net: "MWK 7,400,000",
  },
  {
    crop: "Maize (MH26)",
    price: "MWK 1,050/kg",
    trend: "up",
    trendLabel: "↗ +4.2%",
    yieldKg: "3,500 kg",
    net: "MWK 2,525,000",
  },
  {
    crop: "Tobacco (burley)",
    price: "MWK 3,100/kg",
    trend: "up",
    trendLabel: "↗ +2.1%",
    yieldKg: "1,400 kg",
    net: "MWK 2,240,000",
  },
  {
    crop: "Soya beans",
    price: "MWK 1,720/kg",
    trend: "up",
    trendLabel: "↗ +6.8%",
    yieldKg: "1,800 kg",
    net: "MWK 2,196,000",
  },
  {
    crop: "Groundnuts",
    price: "MWK 2,400/kg",
    trend: "down",
    trendLabel: "↘ -1.4%",
    yieldKg: "1,200 kg",
    net: "MWK 2,100,000",
  },
  {
    crop: "Pigeon peas",
    price: "MWK 1,150/kg",
    trend: "flat",
    trendLabel: "— 0.0%",
    yieldKg: "1,000 kg",
    net: "MWK 730,000",
  },
];

export function classifyAlert(weather) {
  const rain3 = weather.rain3day || 0;
  const wind = weather.current?.wind_speed_10m || 0;
  if (rain3 > 60 || wind > 45) return "severe";
  if (rain3 > 25 || wind > 30) return "watch";
  return "clear";
}

export function fieldAdviceFor(weather) {
  const rain3 = weather.rain3day || 0;
  const temp = weather.current ? weather.current.temperature_2m : null;
  if (rain3 > 40) {
    return "Heavy rain in the last 3 days — check low-lying fields for waterlogging and hold off on fertiliser until it drains.";
  }
  if (rain3 > 10) {
    return "Good recent moisture — a favourable window for planting or transplanting.";
  }
  if (temp !== null && temp > 30 && rain3 < 2) {
    return "Hot and dry — prioritise irrigation where available, and avoid spraying in the midday heat.";
  }
  return "Favourable conditions — good window for planting, weeding and applying fertiliser.";
}

export function seasonAdvice(now = new Date()) {
  const month = now.getMonth();
  const dry = month >= 4 && month <= 7;
  if (dry) {
    return { label: "Dry / winter cropping", text: "Favourable now: Irrigated maize, Vegetables, Wheat" };
  }
  return { label: "Main rainy season", text: "Favourable now: Maize, Groundnuts, Soybeans, Tobacco" };
}

function fmtDayName(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWeather(district, data) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayIdx = data.daily.time.indexOf(todayStr);
  if (todayIdx === -1) todayIdx = 3;

  const rain3day = data.daily.precipitation_sum
    .slice(Math.max(todayIdx - 3, 0), todayIdx)
    .reduce((a, b) => a + (b || 0), 0);

  const forecast = [];
  for (let i = todayIdx; i < Math.min(todayIdx + 5, data.daily.time.length); i++) {
    forecast.push({
      date: data.daily.time[i],
      day: fmtDayName(data.daily.time[i]),
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      rain: data.daily.precipitation_sum[i],
    });
  }

  const parsed = {
    district,
    region: regionForDistrict(district),
    current: data.current,
    rain3day,
    forecast,
    fetchedAt: Date.now(),
  };
  cache.set(district, { at: Date.now(), data: parsed });
  return parsed;
}

export async function fetchDistrictWeather(district) {
  const coords = DISTRICT_COORDS[district];
  if (!coords) throw HttpError(400, "Unknown district");
  const cached = cache.get(district);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const [lat, lon] = coords;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&past_days=3&forecast_days=6&timezone=Africa%2FBlantyre`;
  let res = await fetch(url);
  if (!res.ok) {
    await sleep(400);
    res = await fetch(url);
  }
  if (!res.ok) throw HttpError(502, "Weather service unavailable");
  return parseWeather(district, await res.json());
}

export function alertHeadline(level) {
  if (level === "severe") return "Severe rain or wind risk";
  if (level === "watch") return "Elevated rain or wind";
  if (level === "unavailable") return "Could not reach the live weather service.";
  return "No warnings";
}

export function publicWeather(weather) {
  const level = classifyAlert(weather);
  const season = seasonAdvice();
  return {
    district: weather.district,
    region: weather.region,
    alert: level,
    alertHeadline: alertHeadline(level),
    nowC: Math.round(weather.current.temperature_2m),
    humidity: Math.round(weather.current.relative_humidity_2m),
    rain3dayMm: Number((weather.rain3day || 0).toFixed(1)),
    windKmh: Math.round(weather.current.wind_speed_10m),
    forecast: weather.forecast,
    season,
    fieldAdvice: fieldAdviceFor(weather),
    fetchedAt: weather.fetchedAt,
  };
}

export async function districtAlerts(names = ALERT_DISTRICTS) {
  const results = [];
  for (const district of names) {
    try {
      results.push(publicWeather(await fetchDistrictWeather(district)));
    } catch {
      try {
        await sleep(400);
        results.push(publicWeather(await fetchDistrictWeather(district)));
      } catch {
        results.push({
          district,
          region: regionForDistrict(district),
          alert: "unavailable",
          alertHeadline: alertHeadline("unavailable"),
          advice: "Could not reach the live weather service.",
        });
      }
    }
  }
  return results;
}

export function ussdWeatherLine(summary) {
  const tag = summary.alert === "severe" ? "SEVERE" : summary.alert === "watch" ? "WATCH" : "CLEAR";
  return `${summary.district} ${tag}\n${summary.nowC}C · rain 3d ${summary.rain3dayMm}mm\n${summary.fieldAdvice}`;
}
