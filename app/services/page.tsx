"use client"

import { Check, Gamepad2, ScrollText, Sword, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import SectionDivider from "@/components/section-divider"

export default function ServicesPage() {
  const router = useRouter()

  // Function to handle navigation with scroll to top
  const handleContactNavigation = () => {
    router.push("/contact")
    window.scrollTo(0, 0)
  }

  return (
    <main className="page-transition">
      {/* Website Background - Applied to the entire page */}
      <div className="fixed inset-0 z-[-1]">
        <Image
          src="/images/website-background.png"
          alt="The Wardens Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      <section className="pt-28 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-wardens-gold/5 to-black/20"></div>
          <div className="absolute inset-0 bg-[url('/images/medieval-pattern.png')] opacity-5"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Professional <span className="text-wardens-gold">Gaming Services</span>
            </h1>
            <div className="w-24 h-1 bg-wardens-gold mx-auto mb-6"></div>
            <p className="text-gray-300 max-w-3xl mx-auto">
              The Wardens offers a comprehensive suite of professional services for web3 gaming projects and
              communities.
            </p>
          </div>

          {/* Why The Wardens Box */}
          <div className="max-w-5xl mx-auto bg-black/70 border border-wardens-gold/20 rounded-lg overflow-hidden mb-20 fade-in hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20">
            <div className="p-8">
              <p className="text-gray-300 text-center mb-8">
                Welcome to The Wardens, your trusted partner in web3 gaming. We specialize in gaming activations,
                strategic consulting, and professional gaming services to help projects scale, engage players, and
                optimize their game mechanics.
              </p>

              <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
                Why <span className="text-wardens-gold">The Wardens?</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-wardens-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Sword className="h-8 w-8 text-wardens-gold" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Expert Community</h4>
                  <p className="text-gray-300 text-sm">
                    A hand-selected team of Knights (core community) with years of web3 experience
                  </p>
                </div>

                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-wardens-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-wardens-gold" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Proven Track Record</h4>
                  <p className="text-gray-300 text-sm">Trusted by top web3 gaming projects with measurable results</p>
                </div>

                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-wardens-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Gamepad2 className="h-8 w-8 text-wardens-gold" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">End-to-End Support</h4>
                  <p className="text-gray-300 text-sm">
                    From early engagement to post-launch advisory and ongoing optimization
                  </p>
                </div>
              </div>

              <div className="mt-8 text-center">
                <Button
                  className="bg-wardens-gold hover:bg-wardens-gold/90 text-black font-bold px-8 py-3"
                  onClick={handleContactNavigation}
                >
                  Contact Us Today
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-black/70 border border-wardens-gold/20 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20 fade-in-up stagger-1">
              <CardContent className="p-6">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-wardens-gold/10 flex items-center justify-center">
                    <Gamepad2 className="h-8 w-8 text-wardens-gold" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-center">Gaming Activations</h3>
                <ul className="space-y-2">
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Game Nights</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>AMA Sessions</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Content Program</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Hosted Tournaments</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>P2A Campaigns</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-black/70 border border-wardens-gold/20 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20 fade-in-up stagger-2">
              <CardContent className="p-6">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-wardens-gold/10 flex items-center justify-center">
                    <ScrollText className="h-8 w-8 text-wardens-gold" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-center">Gaming Services</h3>
                <ul className="space-y-2">
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Extensive Feedback Report</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Extensive Project Review</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Quality Assurance Testing</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>In-Depth Game Guides</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Social Media Marketing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-black/70 border border-wardens-gold/20 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20 fade-in-up stagger-3">
              <CardContent className="p-6">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-wardens-gold/10 flex items-center justify-center">
                    <Sword className="h-8 w-8 text-wardens-gold" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-center">Consulting & Strategy</h3>
                <ul className="space-y-2">
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Analytics Dashboards</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Economy Review / Testing</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Game Campaign Strategy</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Community Advisory</span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                    <span>Game Launch Strategy</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Add section divider after service boxes */}
      <SectionDivider />

      {/* Service Packages and Our Process combined into one section */}
      <section className="py-10 relative">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-wardens-gold/5 to-black/20"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          {/* Service Packages */}
          <div className="mb-24">
            <div className="text-center mb-16 fade-in">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Service <span className="text-wardens-gold">Packages</span>
              </h2>
              <div className="w-16 h-1 bg-wardens-gold mx-auto mb-6"></div>
              <p className="text-gray-300 max-w-3xl mx-auto">
                Choose the package that best fits your project's needs and budget. All packages can be customized to
                meet your specific requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Bronze Package */}
              <div className="bg-gradient-to-b from-[#cd7f32]/30 to-black border-2 border-[#cd7f32] rounded-lg overflow-hidden shadow-[0_0_15px_5px_rgba(205,127,50,0.3),_-8px_0_20px_-3px_rgba(205,127,50,0.4),_8px_0_20px_-3px_rgba(205,127,50,0.4),_0_-8px_20px_-3px_rgba(205,127,50,0.4)] hover:shadow-[0_0_25px_8px_rgba(205,127,50,0.5),_-12px_0_30px_-3px_rgba(205,127,50,0.6),_12px_0_30px_-3px_rgba(205,127,50,0.6),_0_-12px_30px_-3px_rgba(205,127,50,0.6)] transition-all duration-300 transform hover:scale-[1.02] fade-in-up stagger-1">
                <div className="bg-[#cd7f32] p-4 text-center">
                  <h3 className="text-2xl font-bold text-black">BRONZE</h3>
                  <p className="text-xl font-bold text-black mt-2">Contact for Pricing</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2">
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>Promoted Game Night</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>Promoted AMA Session</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>Discord Raffles & Event Posts</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>Boosted Promo Tweet</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>Hosted Tournament</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#cd7f32] mr-2 flex-shrink-0" />
                      <span>Project Review</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <Button
                      className="w-full bg-[#cd7f32] hover:bg-[#cd7f32]/80 text-black font-bold"
                      onClick={handleContactNavigation}
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </div>

              {/* Silver Package */}
              <div className="bg-gradient-to-b from-[#C0C0C0]/30 to-black border-2 border-[#C0C0C0] rounded-lg overflow-hidden shadow-[0_0_15px_5px_rgba(192,192,192,0.3),_-8px_0_20px_-3px_rgba(192,192,192,0.4),_8px_0_20px_-3px_rgba(192,192,192,0.4),_0_-8px_20px_-3px_rgba(192,192,192,0.4)] hover:shadow-[0_0_25px_8px_rgba(192,192,192,0.5),_-12px_0_30px_-3px_rgba(192,192,192,0.6),_12px_0_30px_-3px_rgba(192,192,192,0.6),_0_-12px_30px_-3px_rgba(192,192,192,0.6)] transition-all duration-300 transform hover:scale-[1.02] scale-105 fade-in-up stagger-2">
                <div className="bg-[#C0C0C0] p-4 text-center">
                  <h3 className="text-2xl font-bold text-black">SILVER</h3>
                  <p className="text-xl font-bold text-black mt-2">Contact for Pricing</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2">
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>All Bronze Services</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>Extensive Feedback Report</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>Gameplay & Onboarding Guides</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>Community Content Program</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>Strategy Calls</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-[#C0C0C0] mr-2 flex-shrink-0" />
                      <span>Additional Game Activations</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <Button
                      className="w-full bg-[#C0C0C0] hover:bg-[#C0C0C0]/80 text-black font-bold"
                      onClick={handleContactNavigation}
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </div>

              {/* Gold Package */}
              <div className="bg-gradient-to-b from-wardens-gold/30 to-black border-2 border-wardens-gold rounded-lg overflow-hidden shadow-[0_0_15px_5px_rgba(212,175,55,0.3),_-8px_0_20px_-3px_rgba(212,175,55,0.4),_8px_0_20px_-3px_rgba(212,175,55,0.4),_0_-8px_20px_-3px_rgba(212,175,55,0.4)] hover:shadow-[0_0_25px_8px_rgba(212,175,55,0.5),_-12px_0_30px_-3px_rgba(212,175,55,0.6),_12px_0_30px_-3px_rgba(212,175,55,0.6),_0_-12px_30px_-3px_rgba(212,175,55,0.6)] transition-all duration-300 transform hover:scale-[1.02] fade-in-up stagger-3">
                <div className="bg-wardens-gold p-4 text-center">
                  <h3 className="text-2xl font-bold text-black">GOLD</h3>
                  <p className="text-xl font-bold text-black mt-2">Contact for Pricing</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-2">
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                      <span>All Silver Services</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                      <span>Quality Assurance Testing</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                      <span>Campaign Strategy</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                      <span>Community & Game Advisory</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                      <span>Analytics Dashboards</span>
                    </li>
                    <li className="flex items-center text-gray-300">
                      <Check className="h-4 w-4 text-wardens-gold mr-2 flex-shrink-0" />
                      <span>Game Launch Strategy</span>
                    </li>
                  </ul>
                  <div className="mt-8">
                    <Button
                      className="w-full bg-wardens-gold hover:bg-wardens-gold/80 text-black font-bold"
                      onClick={handleContactNavigation}
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Our Process */}
          <div className="mt-20">
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 font-cinzel">
                Our <span className="text-wardens-gold">Process</span>
              </h3>
              <div className="w-16 h-1 bg-wardens-gold mx-auto mb-6"></div>
              <p className="text-gray-300 max-w-3xl mx-auto">
                We follow a structured approach to ensure your gaming project receives the maximum benefit from our
                services.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="bg-black/50 border border-wardens-gold/30 rounded-lg p-6 relative fade-in-up stagger-1 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20">
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-wardens-gold flex items-center justify-center text-black font-bold text-lg">
                  1
                </div>
                <h4 className="text-lg font-bold text-white mb-3 mt-2">Consultation</h4>
                <p className="text-gray-300 text-sm">
                  We begin with an in-depth discussion to understand your project's goals, challenges, and vision.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-black/50 border border-wardens-gold/30 rounded-lg p-6 relative fade-in-up stagger-2 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20">
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-wardens-gold flex items-center justify-center text-black font-bold text-lg">
                  2
                </div>
                <h4 className="text-lg font-bold text-white mb-3 mt-2">Strategy</h4>
                <p className="text-gray-300 text-sm">
                  Our team develops a customized plan tailored to your specific needs and objectives.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-black/50 border border-wardens-gold/30 rounded-lg p-6 relative fade-in-up stagger-3 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20">
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-wardens-gold flex items-center justify-center text-black font-bold text-lg">
                  3
                </div>
                <h4 className="text-lg font-bold text-white mb-3 mt-2">Execution</h4>
                <p className="text-gray-300 text-sm">
                  We implement the agreed-upon services with our team of experienced Knights and gaming experts.
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-black/50 border border-wardens-gold/30 rounded-lg p-6 relative fade-in-up stagger-4 hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20">
                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-wardens-gold flex items-center justify-center text-black font-bold text-lg">
                  4
                </div>
                <h4 className="text-lg font-bold text-white mb-3 mt-2">Analysis</h4>
                <p className="text-gray-300 text-sm">
                  We provide detailed reports and insights to measure success and guide future improvements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add section divider after Our Process section */}
      <SectionDivider />

      {/* FAQ and Contact Us combined into one section */}
      <section className="py-10 relative section-pattern">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-wardens-gold/5 to-black/20"></div>
          <div className="absolute inset-0 bg-[url('/images/medieval-pattern.png')] opacity-5"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          {/* FAQ */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 font-cinzel">
                Frequently Asked <span className="text-wardens-gold">Questions</span>
              </h3>
              <div className="w-16 h-1 bg-wardens-gold mx-auto mb-6"></div>
            </div>

            <div className="max-w-3xl mx-auto">
              <Accordion
                type="single"
                collapsible
                className="bg-black/50 border border-wardens-gold/20 rounded-lg overflow-hidden hover:border-wardens-gold/80 transition-all duration-300 hover:shadow-lg hover:shadow-wardens-gold/20"
              >
                <AccordionItem value="item-1" className="border-b border-wardens-gold/20">
                  <AccordionTrigger className="px-6 py-4 text-white hover:text-wardens-gold">
                    What kinds of games do you work with?
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-gray-300">
                    From pixelated kingdoms to chaotic battlegrounds, we partner with web3 games across all genres—RPGs,
                    strategy, shooters, and more. No matter your genre, the Wardens have the expertise to elevate it.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border-b border-wardens-gold/20">
                  <AccordionTrigger className="px-6 py-4 text-white hover:text-wardens-gold">
                    When can we expect to see results from your services?
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-gray-300">
                    Like any worthy quest, it depends on the path. Our traditional gaming activations and events
                    typically deliver results right out of the gate i.e., a game night. Strategic consulting and deeper
                    campaigns may take 1–3 moons (months) to fully unfold. Rest assured, you'll receive consistent
                    reports and check-ins from our Knights along the way.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border-b border-wardens-gold/20">
                  <AccordionTrigger className="px-6 py-4 text-white hover:text-wardens-gold">
                    Can you tailor your services to our unique needs?
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-gray-300">
                    Absolutely. No two games are alike, neither are our services. We'll sit around the round table with
                    your team and craft a plan forged to suit your needs. Need extra QA? More game nights? Or don't wish
                    for a specific service in a package? We'll adjust as required.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="border-b border-wardens-gold/20">
                  <AccordionTrigger className="px-6 py-4 text-white hover:text-wardens-gold text-left w-full">
                    Do you work with games still in development—or only those already launched?
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-gray-300">
                    Both, brave traveler. Whether your game is in early development or already live on Epic Games/Steam,
                    our Knights are ready. For pre-launch, we offer testing, polish, and go-to-market strategy. For live
                    titles, we bring community activations, retention strategy, and ongoing optimization. We meet you
                    where your journey begins—or continues.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5">
                  <AccordionTrigger className="px-6 py-4 text-white hover:text-wardens-gold">
                    How do we enlist your services?
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-gray-300">
                    Head to our "Get in Touch" section on the CONTACT page and select your desired channel. We'll set a
                    time to talk through your goals, answer your questions, and recommend the right path forward. Don't
                    fancy a full package? No problem! Get in touch and we'll find what's right for your game.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* Contact Us Section */}
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-wardens-gold/10 to-black border border-wardens-gold/30 rounded-lg p-12">
            <div className="text-center mb-8">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 font-cinzel">
                Contact <span className="text-wardens-gold">Us</span>
              </h3>
              <p className="text-xl text-gray-300">
                Contact us to discuss how The Wardens can help you make a difference in web3
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                className="bg-wardens-gold hover:bg-wardens-gold/90 text-black font-bold py-3 px-8 rounded-md text-lg animate-slow-pulse hover:animate-none hover:scale-105 transition-all duration-500"
                onClick={handleContactNavigation}
              >
                Get in Touch
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
