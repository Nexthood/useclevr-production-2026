import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { ContactRequestForm } from "@/components/forms/contact-request-form"
import { Card } from "@/components/ui/card"
import { CalendarDays, Mail } from "lucide-react"

export const metadata = {
  title: "Contact - UseClevr",
  description: "Get in touch with our team",
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in touch</h1>
              <p className="text-lg text-muted-foreground">We'd love to hear from you</p>
            </div>

            <Card className="p-6 md:p-10 bg-card border-border/50">
              <div className="mb-8 flex items-start gap-3">
                <CalendarDays className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Request a demo</h2>
                  <p className="text-muted-foreground">
                    Send the same details you would share in a demo request. We will reply by email.
                  </p>
                </div>
              </div>

              <ContactRequestForm />

              <div className="mt-8 border-t border-border pt-6">
                <h2 className="text-lg font-semibold mb-4">Contact Information</h2>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-[#7C3AED] mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">Email</h3>
                    <a href="mailto:contact@useclevr.com" className="font-medium text-cyan-800 hover:underline dark:text-cyan-100">
                      contact@useclevr.com
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
