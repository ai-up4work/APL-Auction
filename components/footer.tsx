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

          <div>
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">SOCIAL LINKS</h3>
            <ul className="space-y-4">
              <li>
                <Link
                  href="https://discord.gg/thewardensgc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 127 96"
                    fill="currentColor"
                    className="mr-2 text-wardens-gold"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                  Discord
                </Link>
              </li>
              <li>
                <Link
                  href="https://x.com/thewardensgc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center"
                >
                  <Twitter className="h-4 w-4 mr-2 text-wardens-gold" />
                  Twitter
                </Link>
              </li>
              <li>
                <Link
                  href="https://opensea.io/collection/the-wardens-knighthood-membership"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-wardens-gold transition-colors flex items-center"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-wardens-gold" />
                  NFT Collection
                </Link>
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
