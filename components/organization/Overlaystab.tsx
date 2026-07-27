"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Tv, MapPin, Radio, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getFriendlyMatchesForOrg,
  getOverlayConfig,
  saveOverlayChannels,
  saveOverlayWeatherCoords,
  type OrgSummary,
  type FriendlyMatchSummary,
} from "@/lib/organization/organization"

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

type ChannelDraft = { label: string; url: string }

/* ────────────────────────────────────────────────────────────────── */
/*  MATCH REFERENCE — small helper turning a match into a consistent      */
/*  "Team A vs Team B — Round" label, used in the picker and cards so      */
/*  the match reference is never ambiguous.                                */
/* ────────────────────────────────────────────────────────────────── */

function matchLabel(m: FriendlyMatchSummary): string {
  const teams = `${m.team1Name} vs ${m.team2Name}`
  return m.round ? `${teams} — ${m.round}` : teams
}

/* ────────────────────────────────────────────────────────────────── */
/*  MATCH OVERLAY CARD — one row in "Your Overlays", showing the match      */
/*  it's tied to plus a quick configured/not-configured read.               */
/* ────────────────────────────────────────────────────────────────── */

function MatchOverlayCard({
  match,
  selected,
  onSelect,
}: {
  match: FriendlyMatchSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-4 transition-colors ${
        selected ? "border-gold bg-gold/10" : "border-gold/20 bg-black/50 hover:border-gold/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-6 w-6 rounded-full overflow-hidden border border-white/10 bg-black/60 shrink-0 flex items-center justify-center">
          {match.team1Logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.team1Logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Swords className="h-3 w-3 text-gray-500" />
          )}
        </div>
        <div className="h-6 w-6 rounded-full overflow-hidden border border-white/10 bg-black/60 shrink-0 flex items-center justify-center -ml-1">
          {match.team2Logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.team2Logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Swords className="h-3 w-3 text-gray-500" />
          )}
        </div>
      </div>
      <p className="text-white text-sm font-semibold truncate mb-0.5">
        {match.team1Name} <span className="text-gray-500">vs</span> {match.team2Name}
      </p>
      <p className="text-gray-500 text-xs truncate mb-2">{match.round}</p>
      <span
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border ${
          match.overlayConfigured
            ? "border-green-500/40 text-green-400 bg-green-500/[0.08]"
            : "border-white/15 text-gray-500 bg-white/[0.02]"
        }`}
      >
        {match.overlayConfigured ? "Configured" : "Not configured"}
      </span>
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAYS TAB                                                          */
/* ────────────────────────────────────────────────────────────────── */

export function OverlaysTab({ org }: { org: OrgSummary; userId: string }) {
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  const [selectedMatchId, setSelectedMatchId] = useState("")
  const [configLoaded, setConfigLoaded] = useState(false)

  const [channels, setChannels] = useState<ChannelDraft[]>([])
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const reloadMatches = () => getFriendlyMatchesForOrg(org.id).then(setMatches)

  useEffect(() => {
    reloadMatches().then(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null

  const handleSelectMatch = async (matchId: string) => {
    setSelectedMatchId(matchId)
    setConfigLoaded(false)
    setSaveError(null)
    setSaveSuccess(null)
    if (!matchId) return
    const config = await getOverlayConfig(matchId)
    setChannels(config.channels.length > 0 ? config.channels : [{ label: "", url: "" }])
    setLat(config.weatherLat !== null ? String(config.weatherLat) : "")
    setLng(config.weatherLng !== null ? String(config.weatherLng) : "")
    setConfigLoaded(true)
  }

  const updateChannel = (index: number, patch: Partial<ChannelDraft>) => {
    setChannels((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  const addChannelRow = () => setChannels((prev) => [...prev, { label: "", url: "" }])
  const removeChannelRow = (index: number) => setChannels((prev) => prev.filter((_, i) => i !== index))

  const handleSave = async () => {
    if (!selectedMatchId) return
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    const cleanedChannels = channels
      .map((c) => ({ label: c.label.trim(), url: c.url.trim() }))
      .filter((c) => c.label && c.url)

    const channelsOk = await saveOverlayChannels(selectedMatchId, cleanedChannels)

    let weatherOk = true
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)
    if (lat.trim() && lng.trim() && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
      weatherOk = await saveOverlayWeatherCoords(selectedMatchId, parsedLat, parsedLng)
    }

    setIsSaving(false)
    if (!channelsOk || !weatherOk) {
      setSaveError("Couldn't save the overlay config — please try again.")
      return
    }
    setSaveSuccess("Overlay saved.")
    await reloadMatches()
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Tv className="h-4 w-4 text-gold" /> Configure an Overlay
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Every overlay is tied to one match — pick the match below, then set its broadcast channels and the
          location used for the live weather reading.
        </p>

        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading matches…
          </p>
        ) : matches.length === 0 ? (
          <p className="text-gray-500 text-sm italic">
            No matches yet — create one from the <span className="text-gold">Matches</span> tab first.
          </p>
        ) : (
          <>
            <select
              value={selectedMatchId}
              onChange={(e) => handleSelectMatch(e.target.value)}
              className="bg-black/50 border border-gold/30 text-white text-sm rounded-md px-3 py-2 w-full mb-5"
            >
              <option value="">Select a match…</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m)}
                </option>
              ))}
            </select>

            {selectedMatchId && !configLoaded && (
              <p className="text-gray-500 text-sm flex items-center gap-2 mb-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading overlay config…
              </p>
            )}

            {selectedMatchId && configLoaded && selectedMatch && (
              <div className="space-y-5">
                <p className="text-xs text-gray-500 flex items-center gap-1.5 -mt-2">
                  <Swords className="h-3.5 w-3.5 text-gold/60" /> Editing overlay for{" "}
                  <span className="text-white font-semibold">{matchLabel(selectedMatch)}</span>
                </p>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel mb-2 flex items-center gap-1.5">
                    <Radio className="h-3 w-3" /> Broadcast channels
                  </p>
                  <div className="space-y-2">
                    {channels.map((c, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={c.label}
                          onChange={(e) => updateChannel(i, { label: e.target.value })}
                          placeholder="Channel label, e.g. YouTube"
                          className="bg-black/50 border-gold/30 text-white flex-1"
                        />
                        <Input
                          value={c.url}
                          onChange={(e) => updateChannel(i, { url: e.target.value })}
                          placeholder="https://…"
                          className="bg-black/50 border-gold/30 text-white flex-[2]"
                        />
                        <button
                          onClick={() => removeChannelRow(i)}
                          className="text-gray-500 hover:text-red-400 transition-colors shrink-0 self-center sm:self-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addChannelRow}
                    className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gold/70 hover:text-gold mt-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add channel
                  </button>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel mb-2 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> Weather location
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="Latitude, e.g. 6.9271"
                      className="bg-black/50 border-gold/30 text-white flex-1"
                    />
                    <Input
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="Longitude, e.g. 79.8612"
                      className="bg-black/50 border-gold/30 text-white flex-1"
                    />
                  </div>
                  <p className="text-gray-600 text-xs italic mt-1.5">
                    Leave both blank to skip the live weather reading for this match.
                  </p>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  {isSaving ? "Saving…" : "Save Overlay"}
                </Button>

                {saveError && (
                  <p className="flex items-center gap-1.5 text-red-500 text-sm">
                    <AlertCircle className="h-4 w-4" /> {saveError}
                  </p>
                )}
                {saveSuccess && (
                  <p className="flex items-center gap-1.5 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> {saveSuccess}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Panel>

      <div>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 px-1">Your Overlays</h2>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2 px-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : matches.length === 0 ? (
          <Panel>
            <p className="text-gray-500 text-sm italic text-center">
              No matches yet — overlays are configured per match, from the picker above.
            </p>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((m) => (
              <MatchOverlayCard
                key={m.id}
                match={m}
                selected={m.id === selectedMatchId}
                onSelect={() => handleSelectMatch(m.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}