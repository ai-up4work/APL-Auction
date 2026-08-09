"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Twitter, ArrowRight } from "lucide-react"

const Footer = () => {
  const currentYear = new Date().getFullYear()
  const router = useRouter()

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  return (
    <footer className="bg-black border-t border-wardens-gold/20">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12">
                <Image src="/images/wardens-logo.png" alt="The Wardens Logo" fill className="object-contain" />
              </div>
              <span className="font-cinzel font-bold text-2xl text-white">
                THE <span className="text-wardens-gold">WARDENS</span>
              </span>
            </div>
            <p className="text-gray-400">
              The Wardens is a community for gamers and creators, bringing people together through events and shared
              experiences. We also support games directly with services such as QA testing, feedback, and tailored
              activations to help games grow.
            </p>
            {/* Social icons removed as requested */}
          </div>

          <div>
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">NAVIGATION</h3>
            <ul className="space-y-4">
              <li>
                <div
                  onClick={() => handleNavigation("/")}
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-wardens-gold" />
                  Home
                </div>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/game-hub")}
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-wardens-gold" />
                  Game Hub
                </div>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/knights")}
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-wardens-gold" />
                  Knights
                </div>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/services")}
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-wardens-gold" />
                  Services
                </div>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/contact")}
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-wardens-gold" />
                  Contact
                </div>
              </li>
            </ul>
          </div>

       
        </div>

        <div className="mt-16 pt-8 border-t border-wardens-gold/20">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">{currentYear} The Wardens. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <div
                onClick={() => handleNavigation("/privacy-policy")}
                className="text-gray-400 text-sm hover:text-wardens-gold transition-colors cursor-pointer"
              >
                Privacy Policy
              </div>
              <div
                onClick={() => handleNavigation("/terms-of-service")}
                className="text-gray-400 text-sm hover:text-wardens-gold transition-colors cursor-pointer"
              >
                Terms of Service
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
