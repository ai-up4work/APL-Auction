// lib/fetchVenueWeather.ts

export type VenueWeatherResult = {
  venue: string;
  temp: number;
  unit: "C";
  condition: string;
};

export type GeocodeMatch = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

// Open-Meteo WMO weather codes -> WeatherCard's DEFAULT_CONDITIONS keys
// (sunny, clear, partly-cloudy, cloudy, overcast, rain, storm, snow, fog).
// Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
function mapWeatherCode(code: number): string {
  switch (code) {
    case 0: // Clear sky
      return "sunny";
    case 1: // Mainly clear
      return "clear";
    case 2: // Partly cloudy
      return "partly-cloudy";
    case 3: // Overcast
      return "overcast";

    case 45: // Fog
    case 48: // Depositing rime fog
      return "fog";

    // Drizzle (51/53/55) is genuinely light — not the same visual as
    // "rain" (this was the Akkaraipattu bug: WMO 51 was showing as
    // "Rain" when conditions on the ground were basically clear/hazy).
    case 51:
    case 53:
    case 55:
      return "partly-cloudy";

    // Freezing drizzle — still light, but icy; no dedicated key exists,
    // so it goes to cloudy rather than rain (closer visually).
    case 56:
    case 57:
      return "cloudy";

    case 61: // Slight rain
    case 63: // Moderate rain
    case 65: // Heavy rain
    case 80: // Slight rain showers
    case 81: // Moderate rain showers
    case 82: // Violent rain showers
      return "rain";

    case 66: // Freezing rain, light
    case 67: // Freezing rain, heavy
      return "rain";

    case 71: // Slight snow fall
    case 73: // Moderate snow fall
    case 75: // Heavy snow fall
    case 77: // Snow grains
    case 85: // Slight snow showers
    case 86: // Heavy snow showers
      return "snow";

    case 95: // Thunderstorm, slight or moderate
    case 96: // Thunderstorm with slight hail
    case 99: // Thunderstorm with heavy hail
      return "storm";

    default:
      return "cloudy";
  }
}

// Returns up to `count` candidate locations for a free-text query, via
// Photon (Komoot's OSM-based geocoder — https://photon.komoot.io). Used
// both by the one-shot fetchVenueWeather() below and by the live-typing
// autocomplete in LocationAutocomplete.tsx.
//
// Swapped from Open-Meteo's GeoNames-backed geocoder because GeoNames'
// coverage of small settlements is thin and its matching is near-exact
// (no typo tolerance) — that's why venues like small Sri Lankan towns
// returned zero results. Photon indexes OpenStreetMap data instead —
// denser coverage of small places worldwide — and does real fuzzy/prefix/
// n-gram matching server-side, so partial words and slight misspellings
// still resolve. No API key required; it's a public demo instance, so
// keep request volume reasonable (the existing 350ms debounce is fine).
export async function geocodeVenue(query: string, count = 5): Promise<GeocodeMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const geoRes = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${count}&lang=en`
  );
  if (!geoRes.ok) throw new Error("Geocoding lookup failed");

  const geo = await geoRes.json();
  return (geo.features ?? [])
    .filter((f: any) => Array.isArray(f?.geometry?.coordinates))
    .map((f: any) => {
      const p = f.properties ?? {};
      const [longitude, latitude] = f.geometry.coordinates;
      // Photon's "name" is the specific place; city/state/country are
      // separate fields. Fall back to city for POI/street-type results,
      // and only surface admin1 when it isn't redundant with name (so we
      // don't end up showing "Colombo, Colombo" in the dropdown).
      const name: string = p.name ?? p.city ?? p.street ?? q;
      const admin1: string | undefined =
        p.state && p.state !== name ? p.state : p.city && p.city !== name ? p.city : undefined;
      return {
        name,
        admin1,
        country: p.country,
        latitude,
        longitude,
      };
    });
}

// Fetch weather when coordinates are already known (e.g. the admin picked
// a specific autocomplete suggestion) — avoids a redundant geocode call.
export async function fetchWeatherForCoords(
  latitude: number,
  longitude: number,
  displayName: string
): Promise<VenueWeatherResult> {
  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
  );
  if (!wxRes.ok) throw new Error("Weather lookup failed — try again");

  const wx = await wxRes.json();
  if (wx?.current?.temperature_2m == null) throw new Error("No current weather data for that location");

  const temp = Math.round(wx.current.temperature_2m);

  // Above 30°C, treat it as "sunny" regardless of the modeled weather code.
  // Open-Meteo's model can flag a small chance of light drizzle (WMO 51)
  // even when it's hot and clear on the ground (see Akkaraipattu case) —
  // at that temperature, "sunny" is the safer bet than trusting a minor
  // precipitation code. Storm codes still stay "storm" — that mismatch
  // would be worse than the drizzle one, and storms do happen at 30°C+.
  const modeledCondition = mapWeatherCode(wx.current.weather_code);
  const condition = temp > 30 && modeledCondition !== "storm" ? "sunny" : modeledCondition;

  return {
    venue: displayName,
    temp,
    unit: "C",
    condition,
  };
}

// Geocodes a venue/city name to lat/lon (via Photon), then pulls current
// conditions (via Open-Meteo's forecast endpoint). Neither call needs an
// API key. Throws a plain, admin-readable Error on failure so the caller
// can show it directly in the UI.
export async function fetchVenueWeather(venueQuery: string): Promise<VenueWeatherResult> {
  const q = venueQuery.trim();
  if (!q) throw new Error("Enter a venue or city name first");

  const matches = await geocodeVenue(q, 1);
  const match = matches[0];
  if (!match) throw new Error(`Couldn't find a location matching "${q}"`);

  const displayName = match.admin1 ? `${match.name}, ${match.admin1}` : match.name;
  return fetchWeatherForCoords(match.latitude, match.longitude, displayName);
}