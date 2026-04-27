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
            <p className="text-muted-foreground">Last updated: January 15, 2026</p>

            <h2>Agreement to Terms</h2>
            <p>
              By accessing or using UseClevr ("the Service"), you agree to be bound by these Terms of Service ("Terms").
              If you disagree with any part of the terms, you may not access the Service.
            </p>

            <h2>Use of Service</h2>
            <h3>Account Creation</h3>
            <p>
              To use certain features of the Service, you must create an account. You are responsible for maintaining
              the confidentiality of your account credentials and for all activities that occur under your account.
            </p>

            <h3>Acceptable Use</h3>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Upload malicious code or content that violates others' rights</li>
              <li>Use the Service to harass, abuse, or harm another person</li>
            </ul>

            <h2>Your Data</h2>
            <p>
              You retain all rights to the data you upload to UseClevr. By uploading data, you grant us permission to
              process, store, and analyze that data solely for the purpose of providing our services to you.
            </p>

            <h2>Service Availability</h2>
            <p>
              UseClevr is currently in MVP phase. While we strive to provide reliable service, we make no guarantees
              about uptime or availability. We operate on a best-effort basis and may experience occasional downtime for
              maintenance or improvements.
            </p>

            <h2>Subscription and Payment</h2>
            <h3>Paid Plans</h3>
            <p>
              Some features of the Service require a paid subscription. By subscribing to a paid plan, you agree to pay
              all fees associated with your selected plan.
            </p>

            <h3>Cancellation</h3>
            <p>
              You may cancel your subscription at any time. Upon cancellation, you will continue to have access to paid
              features until the end of your current billing period.
            </p>

            <h2>Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, USECLEVR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY
              OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>

            <h2>Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>

            <h2>Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by
              posting the new Terms on this page. Your continued use of the Service after changes constitutes acceptance
              of the modified Terms.
            </p>

            <h2>Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice or
              liability, for any reason, including breach of these Terms.
            </p>

            <h2>Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which
              UseClevr operates, without regard to its conflict of law provisions.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a href="mailto:start@useclevr.com">start@useclevr.com</a>.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
