// app/owner/[auctionId]/join/page.tsx
"use client";

import React, { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import { supabase } from "@/lib/supabse";

interface TeamOption {
  id:    string;
  code:  string;
  name:  string;
  color: string;
  logo:  string | null;
  owner: string | null;
}

type Step        = "select" | "pin";
type VerifyState = "idle" | "loading" | "error" | "granted";

function sessionKey(auctionId: string, teamCode: string) {
  return `owner_auth_${auctionId}_${teamCode.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM CAROUSEL  (replaces FranchiseCarousel, uses real TeamOption shape)
// ─────────────────────────────────────────────────────────────────────────────

function TeamCarousel({
  teams,
  selectedCode,
  onChange,
}: {
  teams:        TeamOption[];
  selectedCode: string;
  onChange:     (code: string) => void;
}) {
  const currentIdx         = teams.findIndex((t) => t.code === selectedCode);
  const dragStartX         = useRef<number | null>(null);
  const draggingPointerId  = useRef<number | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      const next = ((idx % teams.length) + teams.length) % teams.length;
      onChange(teams[next].code);
    },
    [teams, onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current        = e.clientX;
    draggingPointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (dragStartX.current === null || draggingPointerId.current !== e.pointerId) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current        = null;
    draggingPointerId.current = null;
    if (Math.abs(dx) > 30) goTo(currentIdx + (dx < 0 ? 1 : -1));
  };

  const onPointerCancel = () => {
    dragStartX.current        = null;
    draggingPointerId.current = null;
  };

  const getStyle = (rel: number): React.CSSProperties => {
    const n    = teams.length;
    const norm = ((rel % n) + n) % n;
    const r    = norm > n / 2 ? norm - n : norm;

    if (r === 0)
      return {
        transform: "translateX(0) translateZ(0) rotateY(0deg) scale(1)",
        opacity:   1,
        filter:    "none",
        zIndex:    10,
      };

    const side = r < 0 ? -1 : 1;
    const far  = Math.abs(r) > 1;
    return {
      transform: `translateX(${side * (far ? 230 : 128)}px) translateZ(${far ? -160 : -80}px) rotateY(${-side * (far ? 45 : 28)}deg) scale(${far ? 0.65 : 0.82})`,
      opacity:   far ? 0 : 0.6,
      filter:    far ? "blur(3px) grayscale(0.7)" : "blur(1px) grayscale(0.6)",
      zIndex:    far ? 1 : 5,
    };
  };

  const selectedTeam = teams[currentIdx];
  const accentColor  = selectedTeam?.color ?? "#e45d35";

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* 3-D scene */}
      <div
        className="relative w-full overflow-hidden touch-none"
        style={{
          height:            280,
          perspective:       "900px",
          perspectiveOrigin: "50% 50%",
          touchAction:       "none",
        }}
        onPointerDown={onPointerDown}
        onPointerUp={finishDrag}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          {teams.map((team, i) => {
            const rel      = i - currentIdx;
            const isActive = rel === 0;

            return (
              <div
                key={team.code}
                onClick={() => goTo(i)}
                className="absolute cursor-pointer"
                style={{
                  width:      172,
                  transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.45s ease, filter 0.45s ease",
                  transformStyle: "preserve-3d",
                  willChange: "transform, opacity, filter",
                  ...getStyle(rel),
                }}
              >
                <div
                  className="relative rounded-[18px] overflow-hidden border"
                  style={{
                    background:  "linear-gradient(145deg,#1a1f20 0%,#111415 100%)",
                    borderColor: isActive ? `${team.color}70` : "rgba(255,255,255,0.07)",
                    boxShadow:   isActive ? `0 0 28px ${team.color}40` : "none",
                    transition:  "border-color 0.4s ease, box-shadow 0.4s ease",
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 z-10"
                    style={{
                      background: isActive ? team.color : "transparent",
                      transition: "background 0.4s ease",
                    }}
                  />

                  {/* Shimmer */}
                  <div
                    className="absolute inset-0 pointer-events-none rounded-[18px] z-10"
                    style={{
                      background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)",
                    }}
                  />

                  {/* Logo / initials area */}
                  <div
                    className="relative w-full flex items-center justify-center"
                    style={{
                      height:     148,
                      background: `linear-gradient(135deg, ${team.color}18 0%, rgba(11,15,16,0.95) 100%)`,
                    }}
                  >
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={team.code}
                        className="w-24 h-24 object-contain"
                        style={{ filter: isActive ? "none" : "grayscale(0.4)" }}
                      />
                    ) : (
                      <span
                        style={{
                          fontFamily: "'Archivo Narrow', sans-serif",
                          fontSize:   52,
                          fontWeight: 700,
                          fontStyle:  "italic",
                          color:      isActive ? team.color : `${team.color}80`,
                          lineHeight: 1,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {team.code}
                      </span>
                    )}

                    {/* Bottom fade */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                      style={{ background: "linear-gradient(to bottom, transparent, #111415)" }}
                    />

                    {/* Ember glow */}
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
                      style={{
                        width:      80,
                        height:     40,
                        background: isActive ? `${team.color}45` : "transparent",
                        filter:     "blur(18px)",
                        transition: "background 0.45s ease",
                      }}
                    />
                  </div>

                  {/* Name + owner */}
                  <div className="flex flex-col items-center gap-0.5 px-3 pt-2 pb-4 relative">
                    <p
                      style={{
                        fontFamily:    "'Archivo Narrow', sans-serif",
                        fontSize:      13,
                        fontWeight:    700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color:         "#e0e3e4",
                        lineHeight:    "tight",
                        textAlign:     "center",
                      }}
                    >
                      {team.name}
                    </p>
                    {team.owner && (
                      <p
                        style={{
                          fontFamily:    "'Geist Mono', monospace",
                          fontSize:      9,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color:         "#3a4a54",
                          textAlign:     "center",
                        }}
                      >
                        {team.owner}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected label */}
      <p
        style={{
          fontFamily:    "'Geist Mono', monospace",
          fontSize:      9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         accentColor,
          marginTop:     2,
          transition:    "color 0.3s ease",
        }}
      >
        {selectedTeam?.name ?? "Select franchise"}
      </p>

      {/* Pip dots */}
      <div className="flex items-center gap-[7px] mt-3">
        {teams.map((team, i) => (
          <button
            key={team.code}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              height:     5,
              width:      i === currentIdx ? 18 : 5,
              background: i === currentIdx ? accentColor : "rgba(255,255,255,0.15)",
              borderRadius: i === currentIdx ? 3 : "50%",
            }}
            aria-label={`Select ${team.name}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN KEY
// ─────────────────────────────────────────────────────────────────────────────

function PinKey({
  label, sub, icon, onPress, variant = "default",
}: {
  label?:   string;
  sub?:     string;
  icon?:    string;
  onPress:  () => void;
  variant?: "default" | "clear" | "back";
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onPress(); }}
      onPointerLeave={() => setPressed(false)}
      className="flex flex-col items-center justify-center rounded-2xl transition-all duration-100 select-none"
      style={{
        background: pressed
          ? variant === "clear" ? "rgba(228,93,53,0.15)" : "rgba(255,255,255,0.08)"
          : variant === "back" ? "transparent" : "rgba(255,255,255,0.04)",
        border:    variant === "back" ? "none" : "1px solid rgba(255,255,255,0.07)",
        transform: pressed ? "scale(0.94)" : "scale(1)",
        height:    "100%",
        width:     "100%",
      }}
    >
      {icon ? (
        <span
          className="material-symbols-outlined"
          style={{
            fontSize:              26,
            color:                 variant === "clear" ? "#e45d35" : "#c6c6cd",
            fontVariationSettings: "'FILL' 0, 'wght' 300",
          }}
        >
          {icon}
        </span>
      ) : (
        <>
          <span
            style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize:   26,
              fontWeight: 600,
              color:      variant === "clear" ? "#e45d35" : "#e0e3e4",
              lineHeight: 1,
            }}
          >
            {label}
          </span>
          {sub && (
            <span
              style={{
                fontFamily:    "'Geist Mono', monospace",
                fontSize:      8,
                color:         "#3a4a54",
                letterSpacing: "0.12em",
                marginTop:     2,
              }}
            >
              {sub}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FLOW
// ─────────────────────────────────────────────────────────────────────────────

function JoinFlow({ auctionId }: { auctionId: string }) {
  const router = useRouter();

  const [step,         setStep]        = useState<Step>("select");
  const [teams,        setTeams]       = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadError,    setLoadError]   = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [pin,          setPin]         = useState("");
  const [verifyState,  setVerifyState] = useState<VerifyState>("idle");
  const [errorMsg,     setErrorMsg]    = useState("");

  const PIN_LENGTH = 6;

  // ── Load teams ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchTeams() {
      const { data, error } = await supabase
        .from("teams")
        .select("id, code, name, color, logo, owner")
        .eq("auction_id", auctionId)
        .order("created_at", { ascending: true });

      if (error || !data) {
        setLoadError("Couldn't load teams. Check the auction link.");
        setLoadingTeams(false);
        return;
      }

      const mapped: TeamOption[] = data.map((t: any) => ({
        id:    t.id,
        code:  t.code,
        name:  t.name,
        color: t.color || "#e45d35",
        logo:  t.logo  || null,
        owner: t.owner || null,
      }));

      setTeams(mapped);
      if (mapped.length > 0) setSelectedCode(mapped[0].code);
      setLoadingTeams(false);
    }

    fetchTeams().catch(() => {
      setLoadError("Network error. Please try again.");
      setLoadingTeams(false);
    });
  }, [auctionId]);

  // ── PIN input ─────────────────────────────────────────────────────────────
  const appendDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH || verifyState !== "idle") return;
    const next = pin + d;
    setPin(next);
    setErrorMsg("");
    if (next.length === PIN_LENGTH) verify(next);
  };

  const backspace = () => {
    if (verifyState === "loading") return;
    setPin((p) => p.slice(0, -1));
    setErrorMsg("");
    if (verifyState === "error") setVerifyState("idle");
  };

  const clear = () => {
    if (verifyState === "loading") return;
    setPin("");
    setErrorMsg("");
    setVerifyState("idle");
  };

  // ── Verify ────────────────────────────────────────────────────────────────
  async function verify(pinToCheck: string) {
    if (!selectedCode) return;
    setVerifyState("loading");
    setErrorMsg("");

    try {
        const { data, error } = await supabase.rpc("verify_team_pin", {
        p_auction_id: auctionId,
        p_team_code:  selectedCode,
        p_pin:        pinToCheck,
        });

        console.log("[verify_team_pin] data:", data, "error:", error);
        console.log("[verify] auctionId:", auctionId, "teamCode:", selectedCode, "pin:", pinToCheck);

        if (error || !data) {
        setVerifyState("error");
        setErrorMsg("Wrong PIN. Try again.");
        setPin("");
        // ← reset after shake animation completes (350ms) + small buffer
        setTimeout(() => {
            setVerifyState("idle");
            setErrorMsg("");
        }, 1000);
        return;
        }

        sessionStorage.setItem(
        sessionKey(auctionId, selectedCode),
        JSON.stringify({ teamId: data.id, verifiedAt: Date.now() })
        );

        setVerifyState("granted");
        setTimeout(() => {
        router.push(`/owner/${auctionId}/${selectedCode.toLowerCase()}`);
        }, 700);
    } catch {
        setVerifyState("error");
        setErrorMsg("Something went wrong. Try again.");
        setPin("");
        setTimeout(() => {
        setVerifyState("idle");
        setErrorMsg("");
        }, 2000);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedTeam = teams.find((t) => t.code === selectedCode) ?? null;
  const accentColor  = selectedTeam?.color ?? "#e45d35";

  // ── Loading / error states ────────────────────────────────────────────────
  if (loadingTeams) {
    return (
      <div className="h-[100dvh] bg-[#0b0f10] flex flex-col items-center justify-center gap-4">
        <span
          className="material-symbols-outlined animate-spin"
          style={{ fontSize: 40, color: "#e45d35", fontVariationSettings: "'FILL' 1" }}
        >
          progress_activity
        </span>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#3a4a54", textTransform: "uppercase", letterSpacing: "0.16em" }}>
          Loading teams…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-[100dvh] bg-[#0b0f10] flex flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#ef4444", fontVariationSettings: "'FILL' 1" }}>error</span>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#ef4444", letterSpacing: "0.08em" }}>{loadError}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden text-[#e0e3e4]"
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "radial-gradient(circle at 50% 0%, rgba(56,82,131,0.1) 0%, rgb(16,20,21) 80%), linear-gradient(rgb(11,15,16) 0%, rgb(16,20,21) 100%)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-style: normal; line-height: 1;
          display: inline-block; user-select: none;
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        @keyframes slide-up   { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slide-left { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 5px rgba(228,93,53,0.3)} 50%{box-shadow:0 0 20px rgba(228,93,53,0.6)} }
        .anim-up    { animation: slide-up   0.28s ease both; }
        .anim-left  { animation: slide-left 0.28s ease both; }
        .anim-shake { animation: shake 0.35s ease both; }
        .pulse-glow { animation: pulse-glow 2s infinite ease-in-out; }
      `}</style>

      {/* ── Header ── */}
      <header
        className="shrink-0 h-14 flex items-center justify-between px-4 border-b z-50"
        style={{ background: "rgba(11,15,16,0.90)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#e45d35" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#0b0f10", fontVariationSettings: "'FILL' 1" }}>
              sports_cricket
            </span>
          </div>
          <div className="flex flex-col">
            <span style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: 17, fontWeight: 700, fontStyle: "italic", color: "#fff", letterSpacing: "-0.01em", textTransform: "uppercase" }}>
              APL <span style={{ color: "#e45d35" }}>AUCTION</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="pulse-glow w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#e45d35" }} />
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: "#5a6a74", textTransform: "uppercase", letterSpacing: "0.16em" }}>
                Session Live
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === "pin" && (
            <button
              onClick={() => { setPin(""); setVerifyState("idle"); setErrorMsg(""); setStep("select"); }}
              style={{ background: "none", border: "none", color: "#5a6a74", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            </button>
          )}
          {/* Step pills */}
          <div className="flex items-center gap-1.5">
            {[1, 2].map((n) => {
              const active = (n === 1 && step === "select") || (n === 2 && step === "pin");
              const done   = n === 1 && step === "pin";
              return (
                <div
                  key={n}
                  className="flex items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    width:      22,
                    height:     22,
                    background: done ? "#e45d35" : active ? "rgba(228,93,53,0.15)" : "rgba(255,255,255,0.05)",
                    border:     active || done ? `1.5px solid ${done ? "#e45d35" : "rgba(228,93,53,0.5)"}` : "1.5px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {done ? (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600, color: active ? "#e45d35" : "#3a4a54" }}>
                      {n}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* ════════════ STEP 1 — CAROUSEL ════════════ */}
      {step === "select" && (
        <div className="anim-up flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-5 pb-2">
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "#3a4a54", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Swipe to browse · tap to select
            </p>
            <h2 style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: 26, fontWeight: 700, fontStyle: "italic", color: "#fff", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1, marginTop: 4 }}>
              Who are you?
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-0">
            {teams.length > 0 && (
              <TeamCarousel
                teams={teams}
                selectedCode={selectedCode ?? teams[0].code}
                onChange={setSelectedCode}
              />
            )}
          </div>

          <div className="shrink-0 px-4 pt-3 pb-8">
            <button
              onClick={() => { if (selectedCode) setStep("pin"); }}
              disabled={!selectedCode}
              className="w-full h-[58px] rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              style={{
                background: selectedCode ? accentColor : "rgba(255,255,255,0.05)",
                boxShadow:  selectedCode ? `0 6px 28px ${accentColor}50` : "none",
                border:     "none",
                cursor:     selectedCode ? "pointer" : "not-allowed",
                transition: "background 0.3s ease, box-shadow 0.3s ease",
              }}
            >
              <span style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: 17, fontWeight: 700, fontStyle: "italic", color: selectedCode ? "#fff" : "#3a4a54", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {selectedCode
                  ? `Join as ${selectedTeam?.name ?? selectedCode}`
                  : "Select a team first"}
              </span>
              {selectedCode && (
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#fff", fontVariationSettings: "'FILL' 1" }}>
                  arrow_forward
                </span>
              )}
            </button>
          </div>
        </div>
      )}

    {/* ════════════ STEP 2 — PIN ════════════ */}
    {step === "pin" && (
        <div className="anim-in flex-1 flex flex-col min-h-0 px-4 pt-6 pb-5">

            {/* Team context */}
            <div className="shrink-0 text-center mb-5">
            <p style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                color: "#909097", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4,
            }}>
                Joining as <span style={{ color: accentColor }}>{selectedTeam?.name}</span>
            </p>
            <h2 style={{
                fontFamily: "'Archivo Narrow', sans-serif", fontSize: 24,
                fontWeight: 700, color: "#e0e3e4", textTransform: "uppercase",
                letterSpacing: "0.04em", margin: 0,
            }}>
                Enter Secure PIN
            </h2>
            <p style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                color: "#3a4a54", textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 4,
            }}>
                Authorized personnel only
            </p>
            </div>

            {/* PIN boxes */}
            <div
            className={`shrink-0 flex gap-3 mb-2 ${verifyState === "error" ? "anim-shake" : ""}`}
            key={verifyState === "error" ? "shake" : "still"}
            >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                const filled  = i < pin.length;
                const isGrant = verifyState === "granted";
                const isErr   = verifyState === "error";
                return (
                <div
                    key={i}
                    className="flex-1 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={{
                    height: 64,
                    background: isGrant
                        ? "rgba(34,197,94,0.08)"
                        : isErr
                        ? "rgba(239,68,68,0.08)"
                        : filled
                        ? "rgba(16,20,21,0.6)"
                        : "rgba(16,20,21,0.6)",
                    border: isGrant
                        ? "1px solid rgba(34,197,94,0.5)"
                        : isErr
                        ? "1px solid rgba(239,68,68,0.4)"
                        : filled
                        ? `1px solid ${accentColor}60`
                        : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: filled && !isErr && !isGrant
                        ? `0 0 10px ${accentColor}30`
                        : "none",
                    transform: filled ? "scale(1.05)" : "scale(1)",
                    backdropFilter: "blur(20px)",
                    }}
                >
                    <span style={{
                    fontFamily: "'Archivo Narrow', sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: isGrant ? "#22c55e" : isErr ? "#ef4444" : accentColor,
                    }}>
                    {filled ? "●" : ""}
                    </span>
                </div>
                );
            })}
            </div>

            {/* Status message row */}
            <div className="shrink-0 h-7 flex items-center justify-center mb-3">
            {verifyState === "error" && errorMsg && (
                <p style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                {errorMsg}
                </p>
            )}
            {verifyState === "granted" && (
                <p style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                Access granted — entering bid room…
                </p>
            )}
            </div>

            {/* Keypad */}
            <div
            className="flex-1 min-h-0 grid grid-cols-3 mb-4"
            style={{
                gap: 16,
                gridTemplateRows: "repeat(4, 1fr)",
                opacity:       verifyState === "loading" || verifyState === "granted" ? 0.4 : 1,
                pointerEvents: verifyState === "loading" || verifyState === "granted" ? "none" : "auto",
                transition: "opacity 0.2s",
            }}
            >
            {["1","2","3","4","5","6","7","8","9"].map((num) => (
                <button
                key={num}
                onClick={() => appendDigit(num)}
                className="flex flex-col items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
                style={{
                    background: "rgba(16,20,21,0.6)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(20px)",
                    fontFamily: "'Archivo Narrow', sans-serif",
                    fontSize: 26,
                    fontWeight: 600,
                    color: "#e0e3e4",
                    cursor: "pointer",
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,93,53,0.15)"; (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                >
                {num}
                </button>
            ))}

            {/* CLR */}
            <button
                onClick={clear}
                className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
                style={{
                background: "rgba(16,20,21,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "#ffb4ab",
                cursor: "pointer",
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,93,53,0.15)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)"; }}
            >
                CLEAR
            </button>

            {/* 0 */}
            <button
                onClick={() => appendDigit("0")}
                className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
                style={{
                background: "rgba(16,20,21,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 26,
                fontWeight: 600,
                color: "#e0e3e4",
                cursor: "pointer",
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(228,93,53,0.15)"; (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
                0
            </button>

            {/* Backspace */}
            <button
                onClick={backspace}
                className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
                style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#c6c6cd" }}>backspace</span>
            </button>
            </div>

            {/* Verify button — matches mock exactly */}
            <button
            onClick={() => { if (pin.length === PIN_LENGTH && verifyState === "idle") verify(pin); }}
            disabled={pin.length < PIN_LENGTH || verifyState === "loading" || verifyState === "granted"}
            className="shrink-0 w-full h-[64px] rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
            style={{
                fontFamily:    "'Archivo Narrow', sans-serif",
                fontSize:      18,
                fontWeight:    700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                border:        "none",
                cursor: pin.length < PIN_LENGTH || verifyState !== "idle" ? "not-allowed" : "pointer",
                background: verifyState === "granted"
                ? "rgba(34,197,94,0.85)"
                : verifyState === "loading"
                ? "rgba(228,93,53,0.5)"
                : pin.length === PIN_LENGTH
                ? accentColor
                : "rgba(144,144,151,0.1)",
                color: pin.length === PIN_LENGTH || verifyState !== "idle"
                ? "#fff"
                : "rgba(224,227,228,0.3)",
                boxShadow: pin.length === PIN_LENGTH && verifyState === "idle"
                ? `0 0 25px ${accentColor}50`
                : "none",
            }}
            >
            {verifyState === "loading" && (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
                sync
                </span>
            )}
            {verifyState === "granted" ? "Access Granted" : verifyState === "loading" ? "" : "Verify Access"}
            </button>
        </div>
    )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function JoinPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);
  return (
    <MobileOnlyWrapper>
      <JoinFlow auctionId={auctionId} />
    </MobileOnlyWrapper>
  );
}