"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, Twitter, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  // Function to handle navigation with scroll to top
  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  // Navigation links
  const navLinks = [
    { name: "HOME", href: "/", dropdown: [] }, // Added dropdown property
    {
      name: "GAME HUB",
      href: "/game-hub",
      dropdown: [], // Ensure dropdown is properly initialized as empty array
    },
    {
      name: "MEMBERS",
      href: "/knights",
      dropdown: [
        { name: "KNIGHTS", href: "/knights" },
        { name: "CREATORS", href: "/creators" },
      ],
    },
    { name: "SERVICES", href: "/services", dropdown: [] }, // Added dropdown property
    { name: "CONTACT", href: "/contact", dropdown: [] }, // Added dropdown property
  ]

  return (
    <header className="fixed top-0 w-full z-50 transition-all duration-500 bg-black/90 backdrop-blur-sm border-b border-wardens-gold/20 py-2">
      <div className="container mx-auto px-4">
        {/* Desktop Layout - Using grid for better control */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center justify-items-center">
          {/* Logo */}
          <div
            onClick={() => handleNavigation("/")}
            className="flex items-center space-x-2 z-20 justify-self-start cursor-pointer"
          >
            <div className="relative w-14 h-16 md:w-12 md:h-16">
              <Image src="/images/wardens-logo.png" alt="The Wardens Logo" fill className="object-contain" priority />
            </div>
            <span className="font-cinzel font-bold text-xl md:text-2xl text-white">
              THE <span className="text-wardens-gold">WARDENS</span>
            </span>
          </div>

          {/* Navigation - Centered */}
          <nav className="hidden md:flex items-center justify-center space-x-4">
            {navLinks.map((link) =>
              link.dropdown.length > 0 ? (
                <DropdownMenu key={link.name}>
                  <DropdownMenuTrigger>
                    <Button
                      variant={pathname === link.href || pathname.startsWith("/creators") ? "default" : "outline"}
                      className={cn(
                        "font-cinzel text-base transition-all",
                        pathname === link.href || pathname.startsWith("/creators")
                          ? "bg-wardens-gold hover:bg-wardens-gold/90 text-black"
                          : "border-wardens-gold/50 text-white hover:bg-wardens-gold/10 hover:text-wardens-gold hover:border-wardens-gold",
                      )}
                    >
                      {link.name}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-black border border-wardens-gold/30 dropdown-menu-content"
                    sideOffset={5}
                    align="center"
                  >
                    {link.dropdown.map((item) => (
                      <DropdownMenuItem key={item.name} className="focus:bg-wardens-gold/10">
                        <div
                          className="text-white hover:text-wardens-gold w-full block py-1 px-2 cursor-pointer"
                          onClick={() => handleNavigation(item.href)}
                        >
                          {item.name}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  key={link.name}
                  variant={pathname === link.href ? "default" : "outline"}
                  className={cn(
                    "font-cinzel text-base transition-all",
                    pathname === link.href
                      ? "bg-wardens-gold hover:bg-wardens-gold/90 text-black"
                      : "border-wardens-gold/50 text-white hover:bg-wardens-gold/10 hover:text-wardens-gold hover:border-wardens-gold",
                  )}
                  onClick={() => handleNavigation(link.href)}
                >
                  {link.name}
                </Button>
              ),
            )}
          </nav>

          {/* Social Icons and Mobile Menu Button - Right Aligned */}
          <div className="flex items-center justify-end space-x-4 justify-self-end">
            {/* Social Icons - Desktop Only */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Discord Button */}
              <Link href="https://discord.gg/thewardensgc" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-wardens-gold hover:text-wardens-gold/80">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 127 96"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </Button>
              </Link>

              {/* Twitter Link */}
              <Link href="https://x.com/thewardensgc" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-wardens-gold hover:text-wardens-gold/80">
                  <Twitter className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white hover:text-wardens-gold z-20 justify-self-end"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`md:hidden bg-black/95 border-t border-wardens-gold/20 fixed top-[60px] left-0 w-full z-10 transition-all duration-300 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-4 py-6">
          <nav className="flex flex-col space-y-4">
            {navLinks.map((link) =>
              link.dropdown.length > 0 ? (
                <div key={link.name} className="space-y-2">
                  <Button
                    variant={pathname === link.href || pathname.startsWith("/creators") ? "default" : "outline"}
                    className={cn(
                      "font-cinzel text-base w-full justify-start transition-all",
                      pathname === link.href || pathname.startsWith("/creators")
                        ? "bg-wardens-gold hover:bg-wardens-gold/90 text-black"
                        : "border-wardens-gold/50 text-white hover:bg-wardens-gold/10 hover:text-wardens-gold hover:border-wardens-gold",
                    )}
                    onClick={() => {
                      handleNavigation(link.href)
                      setIsOpen(false)
                    }}
                  >
                    {link.name}
                  </Button>
                  <div className="pl-4 space-y-2 border-l border-wardens-gold/20">
                    {link.dropdown.map((item) => (
                      <Button
                        key={item.name}
                        variant="ghost"
                        className="w-full justify-start text-gray-300 hover:text-wardens-gold hover:bg-transparent"
                        onClick={() => {
                          handleNavigation(item.href)
                          setIsOpen(false)
                        }}
                      >
                        {item.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <Button
                  key={link.name}
                  variant={pathname === link.href ? "default" : "outline"}
                  className={cn(
                    "font-cinzel text-base w-full justify-start transition-all",
                    pathname === link.href
                      ? "bg-wardens-gold hover:bg-wardens-gold/90 text-black"
                      : "border-wardens-gold/50 text-white hover:bg-wardens-gold/10 hover:text-wardens-gold hover:border-wardens-gold",
                  )}
                  onClick={() => {
                    handleNavigation(link.href)
                    setIsOpen(false)
                  }}
                >
                  {link.name}
                </Button>
              ),
            )}

            {/* Mobile Social Links */}
            <div className="pt-4 border-t border-wardens-gold/20 flex justify-center space-x-4">
              {/* Discord Icon */}
              <Link
                href="https://discord.gg/thewardensgc"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
              >
                <Button variant="ghost" size="icon" className="text-wardens-gold hover:text-wardens-gold/80">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 127 96"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </Button>
              </Link>

              {/* Twitter Icon */}
              <Link
                href="https://x.com/thewardensgc"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
              >
                <Button variant="ghost" size="icon" className="text-wardens-gold hover:text-wardens-gold/80">
                  <Twitter className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Navbar
