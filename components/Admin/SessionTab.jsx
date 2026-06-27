"use client";

import { useState } from "react";

const TIMER_PRESETS = [
  { label: "10s", value: 10 },
  { label: "15s", value: 15 },
  { label: "20s", value: 20 },
  { label: "30s", value: 30 },
];

const ACCESS_OPTIONS = [
  { key: "private",   icon: "lock",       label: "Private",        desc: "Only team owners can view" },
  { key: "spectator", icon: "visibility",  label: "Spectator Link", desc: "Public read-only view enabled" },
  { key: "broadcast", icon: "cast",        label: "Broadcast",      desc: "Fullscreen display board mode" },
];

function LockBanner() {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-xl mb-6"
      style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fbbf24", flexShrink: 0 }}>lock</span>
      <p style={{ fontSize: "12px", color: "#fbbf24", fontFamily: "'Inter', sans-serif" }}>
        Session configuration is <strong>locked</strong> while the auction is live. Stop or re-auction to make changes.
      </p>
    </div>
  );
}

function SectionCard({ children, style = {} }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{
        background: "rgba(16,20,21,0.4)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
      {children}
    </label>
  );
}

function StyledInput({ placeholder, value, onChange, type = "text", disabled }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
      style={{
        background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: disabled ? "#45464d" : "#e0e3e4",
        fontFamily: "'Inter', sans-serif",
        cursor: disabled ? "not-allowed" : "auto",
      }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = "rgba(228,93,53,0.5)"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
    />
  );
}

export default function SessionTab({ locked = false }) {
  const [auctionName, setAuctionName] = useState("APL Season 1 Auction");
  const [auctioneer, setAuctioneer] = useState("");
  const [auctionDate, setAuctionDate] = useState("");
  const [auctionTime, setAuctionTime] = useState("");
  const [venue, setVenue] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [accessMode, setAccessMode] = useState("spectator");
  const [spectatorLink, setSpectatorLink] = useState("apl-auction.live/watch/s1");
  const [ownerParticipation, setOwnerParticipation] = useState(true);
  const [unsoldReintroduce, setUnsoldReintroduce] = useState(true);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (locked) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // FIX: date and time are a single logical field — count them as one unit
  // Total = 5 logical items: name, auctioneer, dateAndTime, venue, timer
  const dateAndTimeDone = !!(auctionDate && auctionTime);
  const readinessItems = [
    { label: "Auction Name", done: !!auctionName },
    { label: "Auctioneer",   done: !!auctioneer },
    { label: "Date & Time",  done: dateAndTimeDone },
    { label: "Venue",        done: !!venue },
    { label: "Timer Set",    done: timerSeconds > 0 },
    { label: "Access Mode",  done: !!accessMode },
  ];
  const completedCount = readinessItems.filter((i) => i.done).length;
  const totalCount = readinessItems.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">
        {locked && <LockBanner />}

        {/* Heading */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2
              style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: "32px",
                lineHeight: "40px",
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: "#e0e3e4",
              }}
            >
              Session Config{" "}
              <span style={{ color: "rgba(228,93,53,0.55)" }}>({completedCount}/{totalCount} fields)</span>
            </h2>
            <p className="mt-1.5 max-w-xl" style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "22px", color: "#c6c6cd" }}>
              Configure the auction event details, timer behaviour, and access controls before going live.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={locked}
            className="px-5 py-2.5 font-bold flex items-center gap-1.5 rounded-xl transition-all whitespace-nowrap ml-6"
            style={{
              background: locked ? "rgba(255,255,255,0.06)" : saved ? "rgba(52,211,153,0.15)" : "#e45d35",
              color: locked ? "#45464d" : saved ? "#34d399" : "#fff",
              border: saved && !locked ? "1px solid rgba(52,211,153,0.4)" : "none",
              boxShadow: locked || saved ? "none" : "0 0 20px rgba(228,93,53,0.25)",
              fontFamily: "'Geist', monospace",
              fontSize: "12px",
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{saved ? "check" : "save"}</span>
            {saved ? "Saved" : "Save Session"}
          </button>
        </div>

        {/* Event Details */}
        <SectionCard style={{ marginBottom: "20px" }}>
          <h4 className="text-base mb-5 flex items-center gap-2" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#e45d35" }}>event</span>
            Event Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel>Auction Name</FieldLabel>
              <StyledInput placeholder="e.g. APL Season 1" value={auctionName} onChange={(e) => setAuctionName(e.target.value)} disabled={locked} />
            </div>
            <div>
              <FieldLabel>Auctioneer Name</FieldLabel>
              <StyledInput placeholder="e.g. Ravi Shastri" value={auctioneer} onChange={(e) => setAuctioneer(e.target.value)} disabled={locked} />
            </div>
            <div>
              <FieldLabel>Venue</FieldLabel>
              <StyledInput placeholder="e.g. Colombo Hilton, Hall B" value={venue} onChange={(e) => setVenue(e.target.value)} disabled={locked} />
            </div>
            <div>
              <FieldLabel>Auction Date</FieldLabel>
              <StyledInput type="date" value={auctionDate} onChange={(e) => setAuctionDate(e.target.value)} disabled={locked} />
            </div>
            <div>
              <FieldLabel>Start Time</FieldLabel>
              <StyledInput type="time" value={auctionTime} onChange={(e) => setAuctionTime(e.target.value)} disabled={locked} />
            </div>
          </div>
        </SectionCard>

        {/* Timer Settings */}
        <SectionCard style={{ marginBottom: "20px" }}>
          <h4 className="text-base mb-5 flex items-center gap-2" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#e45d35" }}>timer</span>
            Bid Timer
          </h4>
          <div className="flex items-center gap-2 mb-5">
            {TIMER_PRESETS.map((p) => {
              const isActive = timerSeconds === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => !locked && setTimerSeconds(p.value)}
                  disabled={locked}
                  className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: "'Geist', monospace",
                    background: isActive ? "rgba(228,93,53,0.15)" : "rgba(255,255,255,0.04)",
                    border: isActive ? "1px solid rgba(228,93,53,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: locked ? "#45464d" : isActive ? "#e45d35" : "#9a9aa5",
                    cursor: locked ? "not-allowed" : "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
                Custom
              </span>
              <input
                type="number"
                min={5}
                max={120}
                value={timerSeconds}
                disabled={locked}
                onChange={(e) => setTimerSeconds(Number(e.target.value))}
                className="w-14 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: locked ? "#45464d" : "#e0e3e4",
                  fontFamily: "'Geist', monospace",
                  cursor: locked ? "not-allowed" : "auto",
                }}
                onFocus={(e) => { if (!locked) e.currentTarget.style.borderColor = "rgba(228,93,53,0.5)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
              <span style={{ fontSize: "11px", color: "#c6c6cd" }}>sec</span>
            </div>
          </div>
          <div
            className="flex items-center gap-4 p-4 rounded-lg"
            style={{ background: "rgba(24,28,29,0.5)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#e45d35" }}>hourglass_top</span>
            <div className="flex-1">
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#313536" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (timerSeconds / 30) * 100)}%`,
                    background: timerSeconds <= 10 ? "#f87171" : timerSeconds <= 20 ? "#fbbf24" : "#e45d35",
                    transition: "all 0.3s ease",
                  }}
                />
              </div>
              <p className="mt-1.5 text-[10px]" style={{ color: "#c6c6cd", fontFamily: "'Geist', monospace" }}>
                Countdown resets to{" "}
                <span style={{ color: "#e45d35", fontWeight: 700 }}>{timerSeconds}s</span>{" "}
                on every new bid. Player is sold when timer hits 0.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Access & Display */}
        <SectionCard>
          <h4 className="text-base mb-5 flex items-center gap-2" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#e45d35" }}>public</span>
            Access & Display
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {ACCESS_OPTIONS.map((opt) => {
              const isActive = accessMode === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => !locked && setAccessMode(opt.key)}
                  disabled={locked}
                  className="flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all"
                  style={{
                    background: isActive ? "rgba(228,93,53,0.06)" : "rgba(39,43,44,0.4)",
                    border: isActive ? "1.5px solid rgba(228,93,53,0.45)" : "1px solid rgba(69,70,77,0.3)",
                    boxShadow: isActive ? "0 4px 20px rgba(228,93,53,0.1)" : "none",
                    opacity: locked ? 0.6 : 1,
                    cursor: locked ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => { if (!locked && !isActive) { e.currentTarget.style.borderColor = "rgba(228,93,53,0.3)"; e.currentTarget.style.background = "rgba(228,93,53,0.04)"; } }}
                  onMouseLeave={(e) => { if (!locked && !isActive) { e.currentTarget.style.borderColor = "rgba(69,70,77,0.3)"; e.currentTarget.style.background = "rgba(39,43,44,0.4)"; } }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: isActive ? "#e45d35" : "#9a9aa5" }}>{opt.icon}</span>
                  <div>
                    <p className="text-sm font-bold" style={{ fontFamily: "'Archivo Narrow', sans-serif", color: isActive ? "#e0e3e4" : "#c6c6cd" }}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#9a9aa5", fontFamily: "'Inter', sans-serif" }}>{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {accessMode !== "private" && (
            <div>
              <FieldLabel>Spectator / Display URL</FieldLabel>
              <div className="flex gap-2">
                <div
                  className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span className="text-[9px] font-bold uppercase" style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>https://</span>
                  <input
                    type="text"
                    value={spectatorLink}
                    disabled={locked}
                    onChange={(e) => setSpectatorLink(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: locked ? "#45464d" : "#e0e3e4", fontFamily: "'Geist', monospace", cursor: locked ? "not-allowed" : "auto" }}
                  />
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(`https://${spectatorLink}`)}
                  className="px-3 py-2 rounded-lg border transition-all text-[11px] font-bold flex items-center gap-1.5"
                  style={{ background: "rgba(39,43,44,0.4)", borderColor: "rgba(69,70,77,0.3)", color: "#c6c6cd", fontFamily: "'Geist', monospace" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(228,93,53,0.5)"; e.currentTarget.style.color = "#e45d35"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(69,70,77,0.3)"; e.currentTarget.style.color = "#c6c6cd"; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>content_copy</span>
                  Copy
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Right sidebar */}
      <aside className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
        {/* Session Readiness */}
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(16,20,21,0.4)", backdropFilter: "blur(24px)", border: "1px solid rgba(228,93,53,0.12)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <h4 className="text-base mb-4" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
            Session Readiness
          </h4>
          <div className="space-y-3">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: item.done ? "#e0e3e4" : "#9a9aa5", fontFamily: "'Inter', sans-serif" }}>
                  {item.label}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: item.done ? "#34d399" : "#45464d" }}>
                  {item.done ? "check_circle" : "radio_button_unchecked"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex justify-between text-[10px] mb-1.5">
              <span style={{ color: "#c6c6cd", fontFamily: "'Geist', monospace" }}>Completion</span>
              <span style={{ color: "#e45d35", fontFamily: "'Geist', monospace", fontWeight: 700 }}>{pct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#313536" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#e45d35" }} />
            </div>
          </div>
        </div>

        {/* APL Rules Snapshot */}
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(16,20,21,0.4)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <h4 className="text-base mb-4" style={{ fontFamily: "'Archivo Narrow', sans-serif", fontWeight: 600, color: "#e0e3e4" }}>
            APL Rules Snapshot
          </h4>
          <div className="space-y-3">
            {[
              { label: "Team Budget",    value: "50,000 pts" },
              { label: "Squad Size",     value: "16 players" },
              { label: "Base Price",     value: "500 pts" },
              { label: "Owner Buy-in",   value: "3,000 pts" },
              { label: "Unsold Players", value: "Reintroduced" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "#c6c6cd", fontFamily: "'Inter', sans-serif" }}>{item.label}</span>
                <span className="text-[10px] font-black" style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Behaviour Toggles */}
        <div className="p-3 rounded-lg border" style={{ background: "rgba(24,28,29,0.3)", borderColor: "rgba(69,70,77,0.3)", opacity: locked ? 0.5 : 1 }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}>
            Auction Behaviour
          </p>
          <div className="flex flex-col gap-3">
            {[
              { label: "Owner Participation", sub: "3,000 pts auto-deducted", value: ownerParticipation, toggle: () => !locked && setOwnerParticipation((v) => !v) },
              { label: "Reintroduce Unsold",  sub: "At same 500 pt base price", value: unsoldReintroduce, toggle: () => !locked && setUnsoldReintroduce((v) => !v) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "#e0e3e4" }}>{item.label}</p>
                  <p className="text-[9px]" style={{ color: "#9a9aa5" }}>{item.sub}</p>
                </div>
                <button
                  onClick={item.toggle}
                  disabled={locked}
                  className="relative w-9 h-5 rounded-full transition-colors shrink-0"
                  style={{ background: item.value ? "#e45d35" : "rgba(255,255,255,0.1)", cursor: locked ? "not-allowed" : "pointer" }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: item.value ? "calc(100% - 18px)" : "2px" }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}