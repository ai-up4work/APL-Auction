"use client"

import { useEffect, useRef, useState } from "react"

/* ─────────────────────────────────────────────────────────────────────────
   TYPEWRITER REVEAL — plays once, when the text scrolls into view.
   Reserves its own width/height with an invisible ghost copy so nothing
   reflows while it types.
──────────────────────────────────────────────────────────────────────── */
export function TypeText({
  text,
  className = "",
  speed = 40,
  delay = 0,
}: {
  text: string
  className?: string
  speed?: number
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [displayed, setDisplayed] = useState("")
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const hasRun = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true
          setTimeout(() => {
            setStarted(true)
            let i = 0
            const interval = setInterval(() => {
              i++
              setDisplayed(text.slice(0, i))
              if (i >= text.length) {
                clearInterval(interval)
                setTimeout(() => setDone(true), 700)
              }
            }, speed)
          }, delay)
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [text, speed, delay])

  return (
    <span ref={ref} className={className} style={{ position: "relative", display: "inline-block" }}>
      <span aria-hidden="true" style={{ visibility: "hidden", whiteSpace: "pre" }}>
        {text}
      </span>
      <span aria-live="polite" style={{ position: "absolute", top: 0, left: 0, whiteSpace: "pre" }}>
        {started ? displayed : ""}
        {started && !done && (
          <span
            style={{
              display: "inline-block",
              width: "0.05em",
              height: "0.8em",
              backgroundColor: "currentColor",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "tw-blink 0.7s step-end infinite",
            }}
          />
        )}
      </span>
    </span>
  )
}