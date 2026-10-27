/**
 * app/api/risk-signal/route.js
 *
 * Live environmental/geospatial risk enrichment for a single site, modeled
 * directly on app/api/facility/route.js. Free, no-API-key sources:
 *   - Open-Meteo (weather forecast + air quality)
 *   - USGS earthquake GeoJSON feed (seismic activity near the site)
 *   - NASA FIRMS wildfire hotspots (optional — only if NASA_FIRMS_API_KEY is set)
 * Then asks Claude for a 3-paragraph risk briefing combining the live data
 * with the site's own context.
 *
 * Called when the Risk Signals page opens a site's risk drawer.
 */

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchWeather(lat, lon) {
  try {
    const [wxRes, aqRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&forecast_days=3&timezone=auto`, { next: { revalidate: 1800 } }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5`, { next: { revalidate: 1800 } }),
    ]);
    const wx = wxRes.ok ? await wxRes.json() : null;
    const aq = aqRes.ok ? await aqRes.json() : null;
    if (!wx && !aq) return null;
    return {
      current: wx?.current ?? null,
      dailyMaxTempC: wx?.daily?.temperature_2m_max ?? null,
      dailyPrecipMm: wx?.daily?.precipitation_sum ?? null,
      dailyWindMaxKmh: wx?.daily?.wind_speed_10m_max ?? null,
      aqi: aq?.current?.us_aqi ?? null,
      pm25: aq?.current?.pm2_5 ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchSeismic(lat, lon) {
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const nearby = (data.features || [])
      .map(f => ({
        mag: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        distanceKm: haversineKm(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0]),
      }))
      .filter(e => Number.isFinite(e.distanceKm) && e.distanceKm <= 500)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
    return { recentQuakes: nearby, windowDays: 30, minMagnitude: 4.5 };
  } catch {
    return null;
  }
}

async function fetchWildfire(lat, lon) {
  const key = process.env.NASA_FIRMS_API_KEY;
  if (!key) return null;
  try {
    const delta = 1.0; // ~110km half-width bounding box
    const west = lon - delta, south = lat - delta, east = lon + delta, north = lat + delta;
    const res = await fetch(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${west},${south},${east},${north}/1`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const csv = await res.text();
    const lines = csv.trim().split('\n');
    return { hotspotCount: Math.max(0, lines.length - 1) };
  } catch {
    return null;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, lat, lon, existingData } = body;

  if (!name || lat == null || lon == null) {
    return Response.json({ error: 'name, lat and lon required' }, { status: 400 });
  }

  const [weather, seismic, wildfire] = await Promise.all([
    fetchWeather(lat, lon),
    fetchSeismic(lat, lon),
    fetchWildfire(lat, lon),
  ]);

  const liveData = { weather, seismic, wildfire };

  const prompt = `You are analyzing external / environmental risk for a datacenter site using live geospatial data.

## Site Context
${existingData || `${name} (${lat}, ${lon})`}

## Live Weather (Open-Meteo)
${weather ? `Current temp: ${weather.current?.temperature_2m ?? 'N/A'}°C, wind: ${weather.current?.wind_speed_10m ?? 'N/A'} km/h, precipitation: ${weather.current?.precipitation ?? 'N/A'} mm
3-day max temps: ${weather.dailyMaxTempC?.join(', ') ?? 'N/A'}°C
3-day precipitation: ${weather.dailyPrecipMm?.join(', ') ?? 'N/A'} mm
Air Quality Index: ${weather.aqi ?? 'N/A'} (PM2.5: ${weather.pm25 ?? 'N/A'})` : 'No live weather data available.'}

## Recent Seismic Activity (USGS, M4.5+, last 30 days, within 500km)
${seismic?.recentQuakes?.length ? seismic.recentQuakes.map(q => `- M${q.mag} — ${q.place} (${Math.round(q.distanceKm)}km away)`).join('\n') : 'No significant seismic activity detected nearby.'}

${wildfire ? `## Wildfire Hotspots (NASA FIRMS, last 24h, ~110km radius)\n${wildfire.hotspotCount} active hotspot(s) detected.\n` : ''}
Provide a concise 3-paragraph risk intelligence briefing:
1. Current environmental conditions and any active hazard signals
2. Notable risk factors specific to this site's geography (seismic, climate, water, grid)
3. One recommended monitoring or mitigation action

Keep it sharp, data-driven, under 200 words total.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    // Return raw data even without an AI summary.
    return Response.json({ liveData, summary: null });
  }

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    const summary = claudeData.content?.[0]?.text || null;

    return Response.json({ liveData, summary });
  } catch {
    return Response.json({ liveData, summary: null });
  }
}
