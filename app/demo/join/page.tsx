"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import FranchiseCarousel, { Franchise } from "@/components/FranchiseCarousel";

type Step = "select" | "pin";

export default function JoinPage() {
  const [step, setStep] = useState<Step>("select");
  const [pin, setPin] = useState("");
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState("");
  const [verifyState, setVerifyState] = useState<"idle" | "loading" | "granted">("idle");
  const router = useRouter();

  useEffect(() => {
    fetch("/franchises.json")
      .then((r) => r.json())
      .then((data: Franchise[]) => {
        setFranchises(data);
        if (data.length > 0) setSelectedFranchise(data[0].name);
      })
      .catch((e) => console.error("Failed to load franchises.json:", e));
  }, []);

  const handleKeyClick = (num: string) => { if (pin.length < 6) setPin((p) => p + num); };
  const handleBackspace = () => setPin((p) => p.slice(0, -1));
  const handleClear = () => setPin("");
  const handleVerify = () => {
    if (pin.length < 6) return;
    setVerifyState("loading");
    setTimeout(() => {
      setVerifyState("granted");
      setTimeout(() => router.push("/bid"), 800);
    }, 1500);
  };

  const selectedObj = franchises.find((f) => f.name === selectedFranchise);

  return (
    <MobileOnlyWrapper>
      <style>{`
        @keyframes pulse-glow {
          0%,100% { box-shadow: 0 0 5px rgba(228,93,53,0.3); }
          50%      { box-shadow: 0 0 20px rgba(228,93,53,0.6); }
        }
        @keyframes spin-icon { to { transform: rotate(360deg); } }
        @keyframes step-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes step-back {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .pulse-glow  { animation: pulse-glow 2s infinite ease-in-out; }
        .spin-icon   { animation: spin-icon 1s linear infinite; display: inline-block; }
        .anim-in     { animation: step-in 0.28s ease both; }
        .anim-back   { animation: step-back 0.28s ease both; }
        .pin-filled  { border-color: rgba(228,93,53,0.6) !important; box-shadow: 0 0 10px rgba(228,93,53,0.3); transform: scale(1.05); }
        .key-btn:active { transform: scale(0.95); background: rgba(228,93,53,0.15) !important; }
        .icon-filled  { font-variation-settings: 'FILL' 1; }
        .icon-outline { font-variation-settings: 'FILL' 0; }
      `}</style>

      <div
        className="relative flex flex-col h-[100dvh] overflow-hidden text-[#e0e3e4] font-['Inter',sans-serif]"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(56,82,131,0.1) 0%, rgb(16,20,21) 80%), linear-gradient(rgb(11,15,16) 0%, rgb(16,20,21) 100%)",
        }}
      >
        {/* ── Header ── */}
        <header
          className="shrink-0 h-16 flex items-center justify-between px-4 z-50 border-b border-white/10"
          style={{ background: "rgba(16,20,21,0.6)", backdropFilter: "blur(20px)" }}
        >
          <div className="flex flex-col">
            <h1 className="font-['Archivo_Narrow',sans-serif] text-2xl font-bold text-[#e45d35] uppercase tracking-tight leading-none m-0">
              APL AUCTION
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="pulse-glow w-2 h-2 rounded-full bg-[#ffb4ab] inline-block" />
              <span className="font-['Geist',sans-serif] text-[10px] text-[#909097] uppercase tracking-widest">
                SESSION LIVE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <button onClick={() => { if (step === "pin") { setPin(""); setVerifyState("idle"); setStep("select"); } }} className="flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0">
              <div className={`w-5 h-1 rounded-full transition-all duration-300 ${step === "select" ? "bg-[#e45d35]" : "bg-[#e45d35]/40"}`} />
              <div className={`w-5 h-1 rounded-full transition-all duration-300 ${step === "pin" ? "bg-[#e45d35]" : "bg-white/10"}`} />
            </button>
            <div className="flex flex-col items-end">
              <span className="font-['Geist',sans-serif] text-[10px] text-[#909097] uppercase tracking-widest">
                {step === "select" ? "STEP 1 / 2" : "STEP 2 / 2"}
              </span>
              <span className="font-['Geist',sans-serif] text-sm text-[#e0e3e4] tracking-wider">
                {step === "select" ? "SELECT TEAM" : "ENTER PIN"}
              </span>
            </div>
          </div>
        </header>

        {/* ══ STEP 1: Franchise Select ══ */}
        {step === "select" && (
          <div className="anim-back flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Carousel fills remaining space minus CTA */}
            <div className="flex-1 flex flex-col justify-center min-h-0">
              <div className="mb-4 px-4">
                <p className="font-['Geist',sans-serif] text-[10px] text-[#909097] uppercase tracking-widest text-center">
                  Swipe to browse · tap to select
                </p>
              </div>
              {franchises.length > 0 && (
                <FranchiseCarousel
                  franchises={franchises}
                  selected={selectedFranchise}
                  onChange={setSelectedFranchise}
                />
              )}
            </div>

            {/* CTA */}
            <div className="shrink-0 px-4 pb-8 pt-4">
              <button
                onClick={() => { if (selectedFranchise) setStep("pin"); }}
                disabled={!selectedFranchise}
                className="w-full h-[60px] rounded-xl font-['Archivo_Narrow',sans-serif] text-lg font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 bg-[#e45d35] text-white shadow-[0_0_25px_rgba(228,93,53,0.4)]"
              >
                JOIN AS {selectedFranchise || "…"}
                <span className="material-symbols-outlined text-xl icon-filled">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 2: PIN Entry ══ */}
        {step === "pin" && (
          <div className="anim-in flex-1 flex flex-col min-h-0 px-4 pt-6 pb-5">

            {/* Header */}
            <div className="shrink-0 text-center mb-5">
              <p className="font-['Geist',sans-serif] text-[10px] text-[#909097] uppercase tracking-widest mb-1">
                Joining as <span className="text-[#e45d35]">{selectedFranchise}</span>
              </p>
              <h2 className="font-['Archivo_Narrow',sans-serif] text-2xl font-bold text-[#e0e3e4] uppercase tracking-wide m-0">
                ENTER SECURE PIN
              </h2>
              <p className="font-['Geist',sans-serif] text-[10px] text-[#909097] uppercase tracking-widest mt-1">
                Authorized personnel only
              </p>
            </div>

            {/* PIN boxes */}
            <div className="shrink-0 flex gap-3 mb-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={[
                    "flex-1 h-[64px] border rounded-xl flex items-center justify-center",
                    "font-['Archivo_Narrow',sans-serif] text-[22px] font-bold text-[#e45d35] transition-all duration-200",
                    "bg-[rgba(16,20,21,0.6)]",
                    i < pin.length
                      ? "border-[rgba(228,93,53,0.6)] shadow-[0_0_10px_rgba(228,93,53,0.3)] scale-105"
                      : "border-white/10",
                  ].join(" ")}
                  style={{ backdropFilter: "blur(20px)" }}
                >
                  {i < pin.length ? "●" : ""}
                </div>
              ))}
            </div>

            {/* Keypad */}
            <div
              className="flex-1 grid grid-cols-3 gap-4 mb-4"
              style={{ gridTemplateRows: "repeat(4, 1fr)" }}
            >
              {["1","2","3","4","5","6","7","8","9"].map((num) => (
                <button
                  key={num}
                  className="key-btn border border-white/10 rounded-xl flex items-center justify-center font-['Archivo_Narrow',sans-serif] text-2xl font-semibold text-[#e0e3e4] transition-all duration-150 hover:bg-white/5 bg-[rgba(16,20,21,0.6)]"
                  style={{ backdropFilter: "blur(20px)" }}
                  onClick={() => handleKeyClick(num)}
                >
                  {num}
                </button>
              ))}

              <button
                className="key-btn border border-white/10 rounded-xl flex items-center justify-center font-['Geist',sans-serif] text-xs tracking-wider text-[#ffb4ab] transition-all duration-150 hover:bg-white/5 bg-[rgba(16,20,21,0.6)]"
                style={{ backdropFilter: "blur(20px)" }}
                onClick={handleClear}
              >
                CLEAR
              </button>
              <button
                className="key-btn border border-white/10 rounded-xl flex items-center justify-center font-['Archivo_Narrow',sans-serif] text-2xl font-semibold text-[#e0e3e4] transition-all duration-150 hover:bg-white/5 bg-[rgba(16,20,21,0.6)]"
                style={{ backdropFilter: "blur(20px)" }}
                onClick={() => handleKeyClick("0")}
              >
                0
              </button>
              <button
                className="key-btn rounded-xl flex items-center justify-center transition-all duration-150 bg-transparent border-none"
                onClick={handleBackspace}
              >
                <span className="material-symbols-outlined text-[28px] text-[#c6c6cd]">backspace</span>
              </button>
            </div>

            {/* Verify */}
            <button
              onClick={handleVerify}
              disabled={pin.length < 6 || verifyState !== "idle"}
              className={[
                "shrink-0 w-full h-[64px] rounded-xl font-['Archivo_Narrow',sans-serif] text-lg font-bold uppercase tracking-widest",
                "flex items-center justify-center gap-2 transition-all duration-300 border",
                verifyState === "granted"
                  ? "bg-green-700 text-white border-transparent"
                  : pin.length === 6
                  ? "bg-[#e45d35] text-white border-transparent shadow-[0_0_25px_rgba(228,93,53,0.5)]"
                  : "bg-[rgba(144,144,151,0.1)] text-[rgba(224,227,228,0.3)] border-white/5 cursor-not-allowed",
              ].join(" ")}
            >
              {verifyState === "loading" && (
                <span className="material-symbols-outlined spin-icon text-2xl">sync</span>
              )}
              {verifyState === "granted"
                ? "ACCESS GRANTED"
                : verifyState === "loading"
                ? ""
                : "VERIFY ACCESS"}
            </button>
          </div>
        )}

        {/* ── Bottom Nav ── */}
        <nav
          className="shrink-0 h-20 flex justify-around items-center px-2 z-50 border-t border-white/10"
          style={{ background: "rgba(16,20,21,0.8)", backdropFilter: "blur(24px)" }}
        >
          {[
            { icon: "gavel",    label: "Auction",  active: true  },
            { icon: "groups",   label: "Squad",    active: false },
            { icon: "payments", label: "Budget",   active: false },
            { icon: "reorder",  label: "History",  active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={[
                "flex flex-col items-center justify-center py-1 px-3 rounded-xl cursor-pointer",
                item.active ? "text-[#e45d35] bg-[rgba(228,93,53,0.1)]" : "text-[#c6c6cd] bg-transparent",
              ].join(" ")}
            >
              <span className={`material-symbols-outlined text-2xl ${item.active ? "icon-filled" : "icon-outline"}`}>
                {item.icon}
              </span>
              <span className="font-['Geist',sans-serif] text-xs tracking-wider mt-0.5">
                {item.label}
              </span>
            </div>
          ))}
        </nav>
      </div>
    </MobileOnlyWrapper>
  );
}