"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, ArrowRight, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-wardens-gold/10 rounded-full blur-2xl w-32 h-32 mx-auto"></div>
            <div className="relative bg-wardens-gold/5 rounded-2xl p-8 border border-wardens-gold/30">
              <AlertCircle className="w-20 h-20 text-wardens-gold mx-auto" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="font-cinzel text-6xl md:text-7xl font-bold text-foreground">404</h1>
          <p className="font-cinzel text-2xl md:text-3xl font-semibold text-secondary-foreground">Page Not Found</p>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-8">
          <Link href="/">
            <Button
              variant="outline"
              className="w-full border-border text-foreground hover:bg-secondary/50"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
          <Link href="/organization">
            <Button
              className="w-full bg-wardens-gold text-black hover:bg-wardens-gold/90 font-semibold"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
