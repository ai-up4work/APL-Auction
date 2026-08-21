"use client";

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

function Icon({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

/**
 * Weather card — shown in the right-hand aside on desktop, and inside the
 * "Overlay" mobile tab. Locked summary view by default; tap the edit icon
 * to switch to the venue/temp/condition form and push an update.
 *
 * Props:
 *  - weather:        { venue, temp, condition }
 *  - setWeather:      setState updater for the weather object
 *  - weatherEditing:  bool, whether the edit form is open
 *  - setWeatherEditing: setState updater for weatherEditing
 *  - pushLog:         (label: string) => void — writes to the event feed
 *  - fireToast:       (msg: string) => void — pops a bottom-right toast
 *  - mobileTab:        current mobile bottom-nav tab ('scoring' | 'overlay' | 'setup')
 *  - desktopVisible:   bool (default true) — parent sets this to false
 *                       while Match Setup is in its editing state and
 *                       has taken over the whole right column, so this
 *                       card disappears from desktop until editing ends.
 *                       Mobile visibility (via mobileTab) is unaffected.
 */
export default function WeatherPanel({
  weather,
  setWeather,
  weatherEditing,
  setWeatherEditing,
  pushLog,
  fireToast,
  mobileTab,
  desktopVisible = true,
}) {
  return (
    <div
      className={`glass-panel rounded-2xl p-4 mb-8 lg:mb-0 shrink-0 ${
        mobileTab === "overlay" ? "" : "hidden"
      } ${desktopVisible ? "lg:block" : "lg:hidden"}`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-archivo text-sm font-bold italic uppercase">Weather</h3>
        <button
          type="button"
          onClick={() => setWeatherEditing((v) => !v)}
          aria-label={weatherEditing ? "Close weather editor" : "Edit weather"}
          className="h-7 w-7 rounded-lg flex items-center justify-center border border-white/10 shrink-0"
        >
          <Icon name="edit" className="text-on-surface-variant" style={{ fontSize: 13 }} />
        </button>
      </div>

      {!weatherEditing ? (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.02] border border-white/10">
          <Icon name="partly_cloudy_day" className="text-theme-orange shrink-0" style={{ fontSize: 22 }} />
          <div className="min-w-0">
            <p className="font-archivo text-sm font-bold truncate">
              {weather.venue} — {weather.temp}°C, {weather.condition}
            </p>
            <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mt-0.5">
              Pushed with Match Setup
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            value={weather.venue}
            onChange={(e) => setWeather((w) => ({ ...w, venue: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg px-3 py-2 text-xs font-mono-geist bg-white/[0.03] border border-white/10 text-on-surface"
            placeholder="Venue"
            aria-label="Venue"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={weather.temp}
              onChange={(e) => setWeather((w) => ({ ...w, temp: Number(e.target.value) }))}
              className="w-1/2 rounded-lg px-3 py-2 text-xs font-mono-geist bg-white/[0.03] border border-white/10 text-on-surface"
              placeholder="°C"
              aria-label="Temperature in Celsius"
            />
            <input
              value={weather.condition}
              onChange={(e) => setWeather((w) => ({ ...w, condition: e.target.value }))}
              className="w-1/2 rounded-lg px-3 py-2 text-xs font-mono-geist bg-white/[0.03] border border-white/10 text-on-surface"
              placeholder="condition"
              aria-label="Condition"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setWeatherEditing(false);
              pushLog(`Weather set — ${weather.venue}: ${weather.temp}°C, ${weather.condition}`);
              fireToast("Weather pushed");
            }}
            className="w-full py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ background: GOLD_GRADIENT, color: "#1a1304" }}
          >
            Push Weather
          </button>
        </div>
      )}
    </div>
  );
}