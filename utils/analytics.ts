"use client"

// Analytics tracking utility that respects cookie consent and provides detailed event tracking
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

// Check if analytics cookies are accepted
const isAnalyticsEnabled = (): boolean => {
  // Since we don't store in localStorage, we'll check if gtag is available
  // This means analytics was initialized (user accepted cookies)
  return typeof window !== "undefined" && typeof window.gtag === "function"
}

// Initialize Google Analytics
export const initializeAnalytics = () => {
  if (typeof window === "undefined") return

  // Initialize dataLayer if it doesn't exist
  window.dataLayer = window.dataLayer || []

  // Define gtag function
  window.gtag = () => {
    window.dataLayer.push(arguments)
  }

  // Configure GA4
  window.gtag("js", new Date())
  window.gtag("config", "G-Q7ZMH4DK6X", {
    page_title: document.title,
    page_location: window.location.href,
  })

  console.log("[Analytics] Google Analytics initialized")
}

// Track custom events
export const trackEvent = (eventName: string, parameters: Record<string, any> = {}) => {
  if (!isAnalyticsEnabled()) {
    console.log(`[Analytics] Event blocked (cookies not accepted): ${eventName}`, parameters)
    return
  }

  // Send to Google Analytics
  if (window.gtag) {
    window.gtag("event", eventName, {
      event_category: parameters.category || "engagement",
      event_label: parameters.label,
      value: parameters.value,
      custom_parameter_1: parameters.game_name,
      custom_parameter_2: parameters.button_type,
      custom_parameter_3: parameters.destination_url,
      ...parameters,
    })
  }

  // Send to Vercel Analytics (always available)
  if (typeof window !== "undefined" && (window as any).va) {
    ;(window as any).va("track", eventName, parameters)
  }

  console.log(`[Analytics] Event tracked: ${eventName}`, parameters)
}

// Specific tracking functions for common actions
export const trackButtonClick = (buttonName: string, additionalData: Record<string, any> = {}) => {
  trackEvent("button_click", {
    category: "user_interaction",
    label: buttonName,
    button_name: buttonName,
    ...additionalData,
  })
}

export const trackGameWishlist = (gameName: string, platform = "Epic Games") => {
  trackEvent("game_wishlist", {
    category: "game_interaction",
    label: `${gameName} - ${platform}`,
    game_name: gameName,
    platform: platform,
    button_type: "wishlist",
    value: 1,
  })
}

export const trackGamePlay = (gameName: string, platform: string) => {
  trackEvent("game_play", {
    category: "game_interaction",
    label: `${gameName} - ${platform}`,
    game_name: gameName,
    platform: platform,
    button_type: "play_now",
    value: 1,
  })
}

export const trackExternalLink = (linkName: string, destinationUrl: string, category = "external_link") => {
  trackEvent("external_link_click", {
    category: category,
    label: linkName,
    destination_url: destinationUrl,
    link_name: linkName,
  })
}

export const trackSocialLink = (platform: string, destinationUrl: string) => {
  trackEvent("social_link_click", {
    category: "social_media",
    label: platform,
    social_platform: platform,
    destination_url: destinationUrl,
  })
}

export const trackNavigation = (pageName: string, fromPage: string) => {
  trackEvent("page_navigation", {
    category: "navigation",
    label: `${fromPage} -> ${pageName}`,
    from_page: fromPage,
    to_page: pageName,
  })
}

export const trackDiscordJoin = (source = "unknown") => {
  trackEvent("discord_join", {
    category: "community_engagement",
    label: `Discord Join - ${source}`,
    source: source,
    value: 1,
  })
}

// Enhanced sound effect function that also tracks analytics
export const playSoundEffectWithTracking = (soundType = "click", trackingData?: Record<string, any>) => {
  // Original sound effect logic (currently disabled)
  // This maintains compatibility with existing code

  // Add analytics tracking if data is provided
  if (trackingData) {
    trackButtonClick(trackingData.buttonName || "unknown_button", trackingData)
  }
}

// Convenience function to replace existing playSoundEffect calls
export const playSoundEffect = (soundType = "click") => {
  // Completely disabled sound effects - no operations performed
  // This maintains the existing API while doing nothing
}

// Track form submissions
export const trackFormSubmission = (formName: string, success = true) => {
  trackEvent("form_submission", {
    category: "form_interaction",
    label: formName,
    form_name: formName,
    success: success,
    value: success ? 1 : 0,
  })
}

// Track search actions
export const trackSearch = (searchTerm: string, resultsCount = 0) => {
  trackEvent("search", {
    category: "search",
    label: searchTerm,
    search_term: searchTerm,
    results_count: resultsCount,
  })
}
