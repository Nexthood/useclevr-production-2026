import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"

export const metadata = {
  title: "Terms of Service - UseClevr",
  description: "Terms and conditions for using UseClevr",
}

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
            <h1>Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: April 13, 2026</p>

            <h2>1. Overview</h2>
            <p>
              These Terms of Service ("Terms") govern your access to and use of UseClevr, including our website, 
              applications, software, and related services (collectively, the "Service").
            </p>
            <p>
              UseClevr is owned and operated by <strong>Atlas Mega Ventures LLC</strong> ("Atlas Mega Ventures LLC," 
              "UseClevr," "we," "us," or "our").
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these 
              Terms, you may not use the Service.
            </p>

            <h2>2. Eligibility and Account Registration</h2>
            <p>
              To access certain features of the Service, you may be required to create an account. You agree to provide 
              accurate, current, and complete information and to keep your account information up to date.
            </p>
            <p>
              You are responsible for safeguarding your account credentials and for all activity that occurs under your 
              account. You must notify us promptly if you believe your account has been accessed without authorization.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms or create legal, operational, 
              or security risk.
            </p>

            <h2>3. Permitted Use</h2>
            <p>You may use the Service only in compliance with these Terms and applicable law.</p>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful, fraudulent, or abusive purpose</li>
              <li>Interfere with or disrupt the Service, servers, or related infrastructure</li>
              <li>Attempt to gain unauthorized access to the Service, accounts, or systems</li>
              <li>Upload malicious code, malware, or harmful content</li>
              <li>Infringe or violate the intellectual property, privacy, or other rights of any person or entity</li>
              <li>Use the Service to harass, threaten, exploit, or harm others</li>
              <li>Copy, reverse engineer, resell, or misuse the Service except as permitted by law or with our written permission</li>
            </ul>

            <h2>4. User Data</h2>
            <p>
              You retain ownership of the data, files, datasets, prompts, reports, and other content you upload, submit, or generate 
              through the Service ("User Data").
            </p>
            <p>
              By using the Service, you grant Atlas Mega Ventures LLC a limited, non-exclusive right to host, store, process, 
              transmit, analyze, and display User Data solely as necessary to operate, maintain, secure, improve, and provide 
              the Service to you.
            </p>
            <p>You represent and warrant that:</p>
            <ul>
              <li>You have all necessary rights to use and upload your User Data</li>
              <li>Your User Data and use of the Service do not violate any law, regulation, contract, or third-party right</li>
            </ul>

            <h2>5. AI and Analytical Outputs</h2>
            <p>
              The Service may generate AI-assisted or automated outputs, including summaries, reports, forecasts, charts, 
              analyses, recommendations, and other business insights.
            </p>
            <p>You acknowledge and agree that:</p>
            <ul>
              <li>Outputs may contain inaccuracies, omissions, or errors</li>
              <li>Outputs are provided for informational purposes only</li>
              <li>You remain solely responsible for reviewing and validating outputs before relying on them for financial, legal, operational, investment, tax, compliance, or business decisions</li>
            </ul>
            <p>UseClevr does not provide legal, accounting, tax, audit, or investment advice.</p>

            <h2>6. Service Availability</h2>
            <p>
              The Service may include MVP, beta, experimental, or early-stage features.
            </p>
            <p>
              While we aim to maintain availability and reliability, the Service is provided on an <strong>as available</strong> basis. 
              We do not guarantee uninterrupted availability, performance, or error-free operation. We may modify, suspend, 
              or discontinue any part of the Service at any time.
            </p>

            <h2>7. Subscriptions, Billing, and Payments</h2>
            <p>
              Certain features of the Service may require payment, usage credits, or a paid subscription.
            </p>
            <p>By purchasing a paid feature or plan, you agree to:</p>
            <ul>
              <li>Pay all applicable fees, charges, and taxes</li>
              <li>Provide valid payment information</li>
              <li>Authorize us and our payment service providers to process payments related to your selected plan or usage</li>
            </ul>
            <p>Unless otherwise stated, fees are non-refundable except where required by applicable law.</p>
            <p>
              We may update pricing, plans, usage limits, and product features from time to time. Any material pricing 
              change will apply prospectively.
            </p>

            <h2>8. Cancellation and Termination</h2>
            <p>
              You may cancel your subscription at any time. Unless otherwise stated, cancellation will take effect at the end of 
              the current billing period, and you will retain access to paid features until that time.
            </p>
            <p>We may suspend or terminate your access to the Service, with or without notice, if:</p>
            <ul>
              <li>You violate these Terms</li>
              <li>Your use creates legal, operational, or security risk</li>
              <li>We are required to do so by law</li>
              <li>We discontinue the Service or part of it</li>
            </ul>
            <p>
              Any provisions that by their nature should survive termination will survive, including provisions relating to 
              ownership, disclaimers, limitations of liability, indemnification, and governing law.
            </p>

            <h2>9. Intellectual Property</h2>
            <p>
              The Service, including its software, design, interface, branding, trademarks, logos, text, graphics, and 
              related materials, is owned by or licensed to Atlas Mega Ventures LLC and protected by applicable intellectual 
              property laws.
            </p>
            <p>
              Except as expressly permitted in these Terms, you may not copy, modify, distribute, sell, license, or 
              create derivative works from the Service.
            </p>

            <h2>10. Feedback</h2>
            <p>
              If you provide suggestions, comments, ideas, or other feedback regarding the Service, you agree that we 
              may use that feedback without restriction or compensation to you.
            </p>

            <h2>11. Disclaimer of Warranties</h2>
            <p>
              <strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, 
              ATLAS MEGA VENTURES LLC DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, 
              INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, 
              AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.</strong>
            </p>
            <p>
              <strong>WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR THAT ANY 
              OUTPUTS, ANALYSES, OR RESULTS WILL BE ACCURATE, COMPLETE, OR RELIABLE.</strong>
            </p>

            <h2>12. Limitation of Liability</h2>
            <p>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, ATLAS MEGA VENTURES LLC AND ITS AFFILIATES, OFFICERS, 
              DIRECTORS, EMPLOYEES, CONTRACTORS, LICENSORS, AND SERVICE PROVIDERS SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, 
              DATA, BUSINESS, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR USE OF OR 
              INABILITY TO USE THE SERVICE.</strong>
            </p>
            <p>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE TOTAL LIABILITY OF ATLAS MEGA VENTURES LLC ARISING OUT OF 
              OR RELATING TO THE SERVICE OR THESE TERMS SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNT PAID BY YOU 
              TO USECLEVR DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE 
              HUNDRED U.S. DOLLARS (USD $100).</strong>
            </p>

            <h2>13. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Atlas Mega Ventures LLC and its affiliates, officers, directors, 
              employees, contractors, licensors, and service providers from and against any claims, liabilities, damages, 
              judgments, losses, costs, and expenses, including reasonable legal fees, arising out of or related to:
            </p>
            <ul>
              <li>Your use of the Service</li>
              <li>Your User Data</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of applicable law or third-party rights</li>
            </ul>

            <h2>14. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we may provide notice by updating 
              the date above, posting notice within the Service, or using other reasonable means.
            </p>
            <p>
              Your continued use of the Service after the updated Terms become effective constitutes your acceptance 
              of the revised Terms.
            </p>

            <h2>15. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the <strong>State of Wyoming</strong>, 
              without regard to its conflict of laws principles.
            </p>

            <h2>16. Contact</h2>
            <p>If you have questions about these Terms, please contact:</p>
            <p><strong>Atlas Mega Ventures LLC</strong></p>
            <p>Email: <a href="mailto:start@useclevr.com">start@useclevr.com</a></p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}