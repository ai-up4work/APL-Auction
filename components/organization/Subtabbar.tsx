"use client"

// ─────────────────────────────────────────────────────────────
// SUB TAB BAR — single-line secondary nav
//
// Sibling to PrimaryTabBar's curved carousel, but deliberately flat:
// sub-tabs (Rosters: teamPool/playerBank/squadBoard/registrations,
// Events: tournaments/auctions/matches, Broadcast: overlays/brackets)
// are a short, fixed set that never needs to scroll or loop, so they
// get a plain single-line strip instead — an underline-style rail
// with a sliding gold indicator, same visual language (gold, cinzel,
// black glass) as the rest of the dashboard, one level quieter than
// the primary carousel so the hierarchy reads at a glance.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react"

interface SubTabOption<T extends string> {
  value: T
  label: ReactNode
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
  disabledHint?: string
}

export function SubTabBar<T extends string>({
  options,
  active,
  onChange,
}: {
  options: SubTabOption<T>[]
  active: T
  onChange: (v: T) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  const updateIndicator = useCallback(() => {
    const el = itemRefs.current.get(active)
    if (!el) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])

  useEffect(() => {
    updateIndicator()
    window.addEventListener("resize", updateIndicator)
    return () => window.removeEventListener("resize", updateIndicator)
  }, [updateIndicator, options.length])

  // Keep the active sub-tab in view if the strip ever needs to scroll
  // (e.g. narrow viewport with several sub-tabs).
  useEffect(() => {
    const el = itemRefs.current.get(active)
    const track = trackRef.current
    if (!el || !track) return
    const trackRect = track.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    if (elRect.left < trackRect.left || elRect.right > trackRect.right) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
  }, [active])

  return (
    <div
      ref={trackRef}
      className="relative flex items-center gap-6 mb-6 border-b border-gold/15 overflow-x-auto scrollbar-none"
    >
      {options.map((opt) => {
        const isActive = opt.value === active
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) itemRefs.current.set(opt.value, el)
              else itemRefs.current.delete(opt.value)
            }}
            onClick={() => !opt.disabled && onChange(opt.value)}
            disabled={opt.disabled}
            title={opt.disabled ? opt.disabledHint : undefined}
            className={`relative shrink-0 flex items-center gap-1.5 font-cinzel text-[11px] uppercase
              tracking-wide pb-3 pt-1 transition-colors duration-200 disabled:cursor-not-allowed
              disabled:text-gray-700 ${
                isActive ? "text-gold" : "text-gray-400 hover:text-gray-200"
              }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        )
      })}

      {indicator && (
        <span
          className="absolute bottom-0 h-[2px] rounded-full bg-gold shadow-[0_0_8px_rgba(245,166,35,0.5)] transition-all duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </div>
  )
}