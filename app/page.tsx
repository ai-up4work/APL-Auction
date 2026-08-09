"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"
import { HomeContent } from "@/components/landing/home-content"
import { SiteFooter } from "@/components/landing/site-footer"
import { pageStyles, SECTIONS } from "@/data/site-data"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // ---- navbar state ----
  const [isNavOpen, setIsNavOpen] = useState(false)

  // ---- active section tracking, via IntersectionObserver ----
  const [activeSection, setActiveSection] = useState(SECTIONS[0])
  const activeSectionRef = useRef(activeSection)
  activeSectionRef.current = activeSection

  useEffect(() => {
    const sections = SECTIONS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    )

    if (sections.length === 0) return

    const ratios = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        })

        let bestId = activeSectionRef.current
        let bestRatio = 0
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        })

        if (bestRatio > 0 && bestId !== activeSectionRef.current) {
          setActiveSection(bestId)
        }
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "-20% 0px -60% 0px",
      }
    )

    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      window.scrollTo({ top: element.offsetTop - 20, behavior: "smooth" })
      setActiveSection(sectionId)
    }
    setIsNavOpen(false)
  }

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      {/* ---- fixed smooth-scroll section indicator — same rail on every screen size ---- */}
      <div className="fixed right-3 sm:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-50">
        <div className="flex flex-col items-center space-y-3 lg:space-y-4">
          {SECTIONS.map((section) => (
            <button
              key={section}
              onClick={() => scrollToSection(section)}
              className={`rounded-full transition-all duration-300 ${
                activeSection === section
                  ? "bg-gold w-3 h-3 lg:w-4 lg:h-4 shadow-lg shadow-gold/30"
                  : "bg-gray-400 w-2 h-2 lg:w-3 lg:h-3 hover:bg-gold/50"
              }`}
              aria-label={`Scroll to ${section} section`}
            />
          ))}
          <div className="mt-2 text-gold">
            <Shield className="h-4 w-4 lg:h-5 lg:w-5" />
          </div>
        </div>
      </div>

      <SiteHeader
        activeSection={activeSection}
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <HomeContent scrollToSection={scrollToSection} handleNavigation={handleNavigation} />

      <SiteFooter scrollToSection={scrollToSection} handleNavigation={handleNavigation} />
    </main>
  )
}