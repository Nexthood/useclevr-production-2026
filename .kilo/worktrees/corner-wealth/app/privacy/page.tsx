import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"

export const metadata = {
  title: "Privacy Policy - UseClevr",
  description: "How we collect, use, and protect your data",
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert">
            <h1>Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: January 15, 2026</p>

            <h2>Introduction</h2>
            <p>
              UseClevr ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you use our service.
            </p>

            <h2>Information We Collect</h2>
            <h3>Account Information</h3>
            <p>
              When you create an account, we collect information such as your name, email address, and password. This
              information is necessary to provide you with access to our services.
            </p>

            <h3>Data You Upload</h3>
            <p>
              We process the datasets and files you upload to our platform. This data is stored securely and used solely
              to provide our AI-powered analysis services to you.
            </p>

            <h3>Usage Information</h3>
            <p>
              We collect information about how you interact with our service, including queries you make, features you
              use, and actions you take within the platform.
            </p>

            <h2>How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process and analyze your data per your requests</li>
              <li>Communicate with you about your account and our services</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>Data Retention</h2>
            <p>
              We retain your personal information and uploaded data for as long as your account is active or as needed
              to provide you services. You can request deletion of your data at any time by contacting us at{" "}
              <a href="mailto:start@useclevr.com">start@useclevr.com</a>.
            </p>

            <h2>Your Rights (GDPR)</h2>
            <p>If you are in the European Economic Area, you have the following rights:</p>
            <ul>
              <li>
                <strong>Right to access:</strong> You can request a copy of your personal data
              </li>
              <li>
                <strong>Right to rectification:</strong> You can request correction of inaccurate data
              </li>
              <li>
                <strong>Right to erasure:</strong> You can request deletion of your personal data
              </li>
              <li>
                <strong>Right to data portability:</strong> You can request a copy of your data in a machine-readable
                format
              </li>
              <li>
                <strong>Right to object:</strong> You can object to processing of your personal data
              </li>
            </ul>

            <h2>Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your data, including
              encryption at rest and in transit. However, no method of transmission over the internet is 100% secure.
            </p>

            <h2>Third-Party Services</h2>
            <p>
              We may use third-party service providers to help us operate our business and provide services to you.
              These providers have access to your personal information only to perform specific tasks on our behalf and
              are obligated to protect your information.
            </p>

            <h2>Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the "Last updated" date.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:start@useclevr.com">start@useclevr.com</a>.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
