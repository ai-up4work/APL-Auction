"use client"

import Link from "next/link"
import { AlertCircle, ArrowRight, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/landing/site-header"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function NotFound() {
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
            body { overflow-x: hidden; max-width: 100%; }`,
        }}
      />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="min-h-screen flex items-center justify-center relative section-pattern px-4 py-24">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto relative z-10 max-w-xl">
          <div className="bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-8 md:p-12 shadow-lg shadow-black/40 text-center fade-in">
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,166,35,0.15)]">
              <AlertCircle className="w-7 h-7 text-gold" />
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-3 font-cinzel">
              Error 404
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-white font-cinzel tracking-wider mb-3">
              Page Not Found
            </h1>
            <p className="text-gray-400 text-sm max-w-sm mx-auto mb-10">
              The page you're looking for doesn't exist or has been moved.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6 border-t border-gold/10">
              <Link href="/" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full border-gold/30 text-gray-200 font-cinzel uppercase tracking-wide text-xs font-bold hover:bg-white/5 hover:border-gold/60 transition-all"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </Link>
              <Link href="/organization" className="w-full sm:w-auto">
                <Button className="w-full bg-gold hover:bg-gold/90 text-black font-cinzel uppercase tracking-wide text-xs font-bold shadow-[0_0_20px_rgba(245,166,35,0.15)] hover:shadow-[0_0_28px_rgba(245,166,35,0.3)] transition-all">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}