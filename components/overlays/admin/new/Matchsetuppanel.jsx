"use client";

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

function Icon({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

function TogglePill({ label, on, onClick, dotColor }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 font-mono-geist text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 rounded transition-all shrink-0"
      style={{
        background: on ? `${dotColor}1a` : "rgba(255,255,255,0.03)",
        border: `1px solid ${on ? `${dotColor}40` : "rgba(255,255,255,0.08)"}`,
        color: on ? "#e5e7eb" : "rgba(255,255,255,0.4)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: on ? dotColor : "#4b5563" }} />
      {label}
    </button>
  );
}

function GroupLabel({ children, center }) {
  return (
    <span
      className={`font-mono-geist text-[9px] text-theme-orange uppercase tracking-[0.2em] font-bold shrink-0 ${
        center ? "text-center" : "mr-1"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Match Setup card — locked summary bar by default; "Edit" swaps to a
 * pointer to the full Match Editor plus a re-push button. On mobile, also
 * carries the Batting-team toggle (which lives next to the roster panel
 * on desktop, where the roster panel is hidden below lg).
 *
 * Props:
 *  - matchSetup:      { teamA, teamB, matchTitle, venue, format, ... }
 *  - setupEditing:     bool
 *  - setSetupEditing:  setState updater
 *  - setupPushed:      bool — true briefly after a push, for the "Pushed ✓" label
 *  - pushMatchSetup:   () => void
 *  - battingTeam:      'teamA' | 'teamB'
 *  - setBattingTeam:   setState updater
 *  - mobileTab:        current mobile bottom-nav tab
 */
export default function MatchSetupPanel({
  matchSetup,
  setupEditing,
  setSetupEditing,
  setupPushed,
  pushMatchSetup,
  battingTeam,
  setBattingTeam,
  mobileTab,
}) {
  return (
    <div className={`glass-panel rounded-2xl p-4 shrink-0 ${mobileTab === "setup" ? "" : "hidden"} lg:block`}>
      {!setupEditing ? (
        <>
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded bg-theme-orange/10 border border-theme-orange/20 text-theme-orange">
              Match Setup · Locked
            </span>
            <button
              onClick={() => setSetupEditing(true)}
              className="h-7 w-7 rounded-lg flex items-center justify-center border border-white/10 shrink-0"
            >
              <Icon name="edit" className="text-on-surface-variant" style={{ fontSize: 13 }} />
            </button>
          </div>
          <p className="font-archivo text-sm font-bold uppercase italic">
            {matchSetup.teamA} <span className="text-on-surface-variant not-italic font-normal">vs</span> {matchSetup.teamB}
          </p>
          <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.08em] mt-1">
            {matchSetup.matchTitle} · {matchSetup.venue} · {matchSetup.format}
          </p>
          {/* Mobile-only: stand-in for the desktop Batting toggle, which
             lives next to the roster panel (hidden below lg). */}
          <div className="flex items-center gap-2 mt-3 lg:hidden">
            <GroupLabel>Batting</GroupLabel>
            <TogglePill label={matchSetup.teamA} on={battingTeam === "teamA"} dotColor="#c9971f" onClick={() => setBattingTeam("teamA")} />
            <TogglePill label={matchSetup.teamB} on={battingTeam === "teamB"} dotColor="#c9971f" onClick={() => setBattingTeam("teamB")} />
          </div>
        </>
      ) : (
        <>
          <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold mb-3">
            Editing Match Setup
          </p>
          <p className="font-mono-geist text-[10px] text-on-surface-variant leading-relaxed mb-3">
            Team names, squads, toss and venue live in the full Match Editor. This is a locked summary — push again once you're done there.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSetupEditing(false)}
              className="flex-1 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] border border-white/10 text-on-surface-variant"
            >
              Cancel
            </button>
            <button
              onClick={pushMatchSetup}
              className="flex-1 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ background: GOLD_GRADIENT, color: "#1a1304" }}
            >
              {setupPushed ? "Pushed ✓" : "Push Setup"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}