/** Часы + погода. Исправлено: один интервал погоды, надёжные фолбэки. */

import { $ } from './utils.js';
import { store } from './storage.js';

const geoCache = new Map();
let tickTimer = null;
let wxTimer = null;
let slots = [];

async function geocode(city) {
  if (!city || city === '—') return null;
  if (geoCache.has(city)) return geoCache.get(city);
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`
    );
    const d = await r.json();
    const g = d && d.results && d.results[0];
    const info = g ? { lat: g.latitude, lon: g.longitude, tz: g.timezone || null } : null;
    geoCache.set(city, info);
    return info;
  } catch (e) {
    geoCache.set(city, null);
    return null;
  }
}

async function weather(lat, lon) {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
  );
  const d = await r.json();
  return { t: Math.round(d.current.temperature_2m), code: d.current.weather_code };
}

function wxEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '❄️';
  return '⛈️';
}

function tick() {
  const now = new Date();
  slots.forEach((s, i) => {
    const elT = $(i === 0 ? '#time-a' : '#time-b');
    if (!elT) return;
    try {
      elT.textContent = new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: s.tz || undefined
      }).format(now);
    } catch (e) {
      elT.textContent = now.toLocaleTimeString('ru-RU');
    }
  });
}

async function refreshWeather() {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const wxEl = $(i === 0 ? '#wx-a' : '#wx-b');
    if (!wxEl) continue;
    if (!s || !s.geo) { wxEl.textContent = '—'; continue; }
    try {
      const w = await weather(s.geo.lat, s.geo.lon);
      wxEl.textContent = `${w.t > 0 ? '+' : ''}${w.t}°C ${wxEmoji(w.code)}`;
    } catch (e) {
      wxEl.textContent = '—';
    }
  }
}

export async function initClocks() {
  if (tickTimer) clearInterval(tickTimer);
  if (wxTimer) clearInterval(wxTimer);

  const s = await store.get('settings');
  const cities = s.cities || ['—', '—'];
  slots = [];

  for (let i = 0; i < 2; i++) {
    const city = cities[i] || '—';
    const nameEl = $(i === 0 ? '#city-a' : '#city-b');
    if (nameEl) nameEl.textContent = String(city).toUpperCase();
    const geo = await geocode(city);
    slots.push({ city, tz: geo ? geo.tz : null, geo });
  }

  tick();
  tickTimer = setInterval(tick, 1000);
  refreshWeather();
  wxTimer = setInterval(refreshWeather, 30 * 60 * 1000);
}
