import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"
import { Card } from "@/components/ui/card"
import { Mail } from "lucide-react"

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

            <Card className="p-10 bg-card border-border/50">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <p className="text-muted-foreground mb-6">Reach out to our team for any inquiries</p>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-[#7C3AED] mt-0.5" />
                <div>
                  <h3 className="font-medium mb-1">Email</h3>
                  <a href="mailto:contact@useclevr.com" className="text-[#06B6D4] hover:underline">
                    contact@useclevr.com
                  </a>
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
