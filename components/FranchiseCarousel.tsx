"use client";
import React, { useRef, useCallback } from "react";
import Image from "next/image";

export type Franchise = { id: string; name: string; city: string; image: string };

export default function FranchiseCarousel({
  franchises,
  selected,
  onChange,
}: {
  franchises: Franchise[];
  selected: string;
  onChange: (name: string) => void;
}) {
  const currentIdx = franchises.findIndex((f) => f.name === selected);
  const dragStartX = useRef<number | null>(null);
  const draggingPointerId = useRef<number | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      const next = (idx + franchises.length) % franchises.length;
      onChange(franchises[next].name);
    },
    [franchises, onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    draggingPointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (dragStartX.current === null || draggingPointerId.current !== e.pointerId) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    draggingPointerId.current = null;
    if (Math.abs(dx) > 30) goTo(currentIdx + (dx < 0 ? 1 : -1));
  };

  const onPointerCancel = () => {
    dragStartX.current = null;
    draggingPointerId.current = null;
  };

  const getStyle = (rel: number): React.CSSProperties => {
    const n = franchises.length;
    const norm = ((rel % n) + n) % n;
    const r = norm > n / 2 ? norm - n : norm;

    if (r === 0)
      return {
        transform: "translateX(0) translateZ(0) rotateY(0deg) scale(1)",
        opacity: 1,
        filter: "none",
        zIndex: 10,
      };
    const side = r < 0 ? -1 : 1;
    const far = Math.abs(r) > 1;
    return {
      transform: `translateX(${side * (far ? 230 : 128)}px) translateZ(${far ? -160 : -80}px) rotateY(${-side * (far ? 45 : 28)}deg) scale(${far ? 0.65 : 0.82})`,
      opacity: far ? 0 : 0.6,
      filter: far ? "blur(3px) grayscale(0.7)" : "blur(1px) grayscale(0.6)",
      zIndex: far ? 1 : 5,
    };
  };

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* 3-D scene */}
      <div
        className="relative w-full overflow-hidden touch-none"
        style={{ height: 270, perspective: "900px", perspectiveOrigin: "50% 50%", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerUp={finishDrag}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          {franchises.map((f, i) => {
            const rel = i - currentIdx;
            const isActive = rel === 0;
            return (
              <div
                key={f.id}
                onClick={() => goTo(i)}
                className="absolute cursor-pointer"
                style={{
                  width: 172,
                  transition:
                    "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.45s ease, filter 0.45s ease",
                  transformStyle: "preserve-3d",
                  willChange: "transform, opacity, filter",
                  ...getStyle(rel),
                }}
              >
                {/* card face */}
                <div
                  className="relative rounded-[18px] overflow-hidden border"
                  style={{
                    background: "linear-gradient(145deg,#1a1f20 0%,#111415 100%)",
                    borderColor: isActive
                      ? "rgba(228,93,53,0.45)"
                      : "rgba(255,255,255,0.07)",
                    boxShadow: isActive
                      ? "0 0 20px rgba(228,93,53,0.15) inset"
                      : "none",
                    transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                  }}
                >
                  {/* shimmer */}
                  <div
                    className="absolute inset-0 pointer-events-none rounded-[18px] z-10"
                    style={{
                      background:
                        "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)",
                    }}
                  />

                  {/* logo frame — crest is object-contain and scaled up so it
                      visually fills the box, since source crests are square
                      PNGs with their own transparent padding around the
                      badge (object-cover alone just zooms into that
                      transparency rather than the artwork). */}
                  <div
                    className="relative w-full flex items-center justify-center overflow-hidden"
                    style={{
                      height: 148,
                      background:
                        "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05) 0%, transparent 70%)",
                    }}
                  >
                    <div className="relative" style={{ width: "82%", height: "82%" }}>
                      <Image
                        src={f.image}
                        alt={f.name}
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {/* bottom fade into card body */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(to bottom, transparent, #111415)",
                      }}
                    />
                  </div>

                  {/* ember glow */}
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
                    style={{
                      width: 80,
                      height: 40,
                      background: isActive ? "rgba(228,93,53,0.28)" : "transparent",
                      filter: "blur(18px)",
                      transition: "background 0.45s ease",
                    }}
                  />

                  {/* name + city */}
                  <div className="flex flex-col items-center gap-0.5 px-3 pt-2 pb-4 relative">
                    <p className="font-['Archivo_Narrow',sans-serif] text-[13px] font-bold uppercase tracking-[0.04em] text-[#e0e3e4] leading-tight text-center">
                      {f.name}
                    </p>
                    <p
                      className="font-['Geist',monospace,sans-serif] text-[9px] tracking-[0.14em] uppercase"
                      style={{ color: "#454750" }}
                    >
                      {f.city}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p
        className="font-['Geist',monospace,sans-serif] text-[9px] tracking-[0.16em] uppercase mt-0.5"
        style={{ color: "#e45d35" }}
      >
        Selected franchise
      </p>

      {/* pip dots */}
      <div className="flex items-center gap-[7px] mt-3">
        {franchises.map((f, i) => (
          <button
            key={f.id}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              height: 5,
              width: i === currentIdx ? 18 : 5,
              background: i === currentIdx ? "#e45d35" : "rgba(255,255,255,0.15)",
              borderRadius: i === currentIdx ? 3 : "50%",
            }}
            aria-label={`Select ${f.name}`}
          />
        ))}
      </div>
    </div>
  );
}