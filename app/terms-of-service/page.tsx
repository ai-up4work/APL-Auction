import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import SectionDivider from "@/components/section-divider"

export default function TermsOfServicePage() {
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

      <section className="pt-28 pb-16 relative">
        <div className="absolute inset-0 z-0 bg-black/80"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="text-gray-300 hover:text-wardens-gold">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>

          <div className="max-w-4xl mx-auto bg-black/50 border border-wardens-gold/20 rounded-lg p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 font-cinzel">
              Terms of <span className="text-wardens-gold">Service</span>
            </h1>
            <div className="w-24 h-1 bg-wardens-gold mb-8"></div>

            <div className="space-y-6 text-gray-300">
              <p>
                <strong>Last Updated:</strong> April 1, 2025
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
              <p>
                Welcome to The Wardens. By accessing or using our website, services, community platforms, or any of our
                applications (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms").
                If you do not agree to these Terms, please do not use our Services.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">2. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will provide notice of any material changes
                by updating the "Last Updated" date at the top of these Terms. Your continued use of the Services after
                such modifications will constitute your acknowledgment and agreement to the modified Terms.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">3. Services Description</h2>
              <p>
                The Wardens provides a professional gaming hub for gamers, content creators, and industry leaders in the
                web3 space. Our Services include but are not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Gaming activations and events</li>
                <li>Professional gaming services</li>
                <li>Strategic consulting for web3 gaming projects</li>
                <li>Community engagement and networking opportunities</li>
                <li>Content creation and distribution</li>
                <li>Knighthood NFT membership program</li>
              </ul>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">4. User Accounts and Registration</h2>
              <p>
                Some of our Services may require you to create an account or connect a digital wallet. You agree to
                provide accurate, current, and complete information during the registration process and to update such
                information to keep it accurate, current, and complete.
              </p>
              <p className="mt-4">
                You are responsible for safeguarding your account credentials and for any activities or actions under
                your account. You agree to notify us immediately of any unauthorized use of your account or any other
                breach of security.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">5. User Conduct</h2>
              <p>You agree not to use the Services to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Violate any applicable law or regulation</li>
                <li>Infringe upon the rights of others</li>
                <li>Distribute harmful, offensive, or inappropriate content</li>
                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                <li>Engage in any activity that could damage, disable, or impair the functioning of our Services</li>
                <li>Use our Services for any illegal or unauthorized purpose</li>
              </ul>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">6. Intellectual Property</h2>
              <p>
                The Services and their original content, features, and functionality are owned by The Wardens and are
                protected by international copyright, trademark, patent, trade secret, and other intellectual property
                or proprietary rights laws.
              </p>
              <p className="mt-4">
                You may not copy, modify, create derivative works of, publicly display, publicly perform, republish, or
                transmit any of the material obtained through our Services without our prior written consent.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">7. Third-Party Links and Services</h2>
              <p>
                Our Services may contain links to third-party websites or services that are not owned or controlled by
                The Wardens. We have no control over, and assume no responsibility for, the content, privacy policies,
                or practices of any third-party websites or services.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">8. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, The Wardens and its affiliates, officers, employees, agents,
                partners, and licensors shall not be liable for any indirect, incidental, special, consequential, or
                punitive damages, including without limitation, loss of profits, data, use, goodwill, or other
                intangible losses, resulting from:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Your access to or use of or inability to access or use the Services</li>
                <li>Any conduct or content of any third party on the Services</li>
                <li>Any content obtained from the Services</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              </ul>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">9. Disclaimer of Warranties</h2>
              <p>
                The Services are provided on an "AS IS" and "AS AVAILABLE" basis, without any warranties of any kind,
                either express or implied. We disclaim all warranties, including, but not limited to, implied warranties
                of merchantability, fitness for a particular purpose, and non-infringement.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">10. Termination of Service</h2>
              <p>
                In our sole discretion, services my be terminted with 30 days written notice to the user. The user may
                terminate any agreement with the Wardens with 30 days written notice. Pro rated refunds may be given
                under the fee schedule as set out in applicable Schedules.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">11. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United Kingdom,
                without regard to its conflict of law provisions. Any disputes arising under these Terms shall be
                interpreted and resolved in the United Kingdom.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">12. Dispute Resolution</h2>
              <p>
                Any dispute arising from or relating to these Terms or our Services shall first be resolved through
                good-faith negotiations. If such negotiations fail, the dispute shall be resolved through arbitration in
                accordance with the rules of the London Court of International Arbitration (LCIA).
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">13. Severability</h2>
              <p>
                If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed
                and interpreted to accomplish the objectives of such provision to the greatest extent possible under
                applicable law, and the remaining provisions will continue in full force and effect.
              </p>

              <h2 className="text-xl font-bold text-white mt-8 mb-4">14. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at:</p>
              <p className="mt-2">Email: thewardensgc@gmail.com</p>
              <p>Discord: discord.gg/thewardensgc</p>
            </div>
          </div>
        </div>
      </section>
      <SectionDivider />
    </main>
  )
}
