"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

interface HeroSlide {
  /** Image shown on tablet/desktop viewports (md and up) */
  desktop: string
  /** Optional image shown on phones (below md). Falls back to `desktop` if omitted. */
  mobile?: string
  alt: string
}

// ─────────────────────────────────────────────────────────────
// SLIDES — edit this list to add/remove/reorder hero images.
// Slide 0 is the current default image and stays first; it's
// the one that loads with `priority` for LCP.
// ─────────────────────────────────────────────────────────────
const SLIDES: HeroSlide[] = [
  {
    desktop: "/images/landing-image.png",
    mobile: "/images/landing-image-mobile.png",
    alt: "Valiant League background",
  },
  // Add more slides here later, e.g.:
  // {
  //   desktop: "/images/landing-image-2.png",
  //   mobile: "/images/landing-image-2-mobile.png",
  //   alt: "Live auction in progress",
  // },
]

// Milliseconds between transitions.
const INTERVAL_MS = 5000
// Pause auto-advance while the tab is hidden.
const PAUSE_WHEN_HIDDEN = true

export function HeroImageCarousel() {
  const [index, setIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasMultipleSlides = SLIDES.length > 1

  useEffect(() => {
    if (!hasMultipleSlides) return

    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % SLIDES.length)
      }, INTERVAL_MS)
    }
    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    start()

    if (PAUSE_WHEN_HIDDEN) {
      const onVisibility = () => {
        if (document.hidden) stop()
        else start()
      }
      document.addEventListener("visibilitychange", onVisibility)
      return () => {
        stop()
        document.removeEventListener("visibilitychange", onVisibility)
      }
    }

    return stop
  }, [hasMultipleSlides])

  if (SLIDES.length === 0) return null

  const current = SLIDES[index]

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        >
          {/* Subtle Ken Burns drift — skipped entirely if the user prefers reduced motion */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: prefersReducedMotion ? 1 : 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: INTERVAL_MS / 1000 + 1, ease: "linear" }}
          >
            {/* Desktop / tablet image */}
            <div className="hidden md:block absolute inset-0">
              <Image
                src={current.desktop}
                alt={current.alt}
                fill
                priority={index === 0}
                className="object-cover object-center"
              />
            </div>
            {/* Mobile image — falls back to desktop image if no mobile variant given */}
            <div className="block md:hidden absolute inset-0">
              <Image
                src={current.mobile || current.desktop}
                alt={current.alt}
                fill
                priority={index === 0}
                className="object-cover object-center"
              />
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      {hasMultipleSlides && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? "24px" : "6px",
                backgroundColor: i === index ? "#f5a623" : "rgba(245,166,35,0.35)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default HeroImageCarousel