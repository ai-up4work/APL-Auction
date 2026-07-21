import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Audiowide } from "next/font/google"
import "@/styles/auth.css";

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const aurora = Audiowide({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-aurora",
})


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // <html lang="en">
      <div className={`${aurora.className} font-sans antialiased`}>
        {children}
      </div>
  )
}
