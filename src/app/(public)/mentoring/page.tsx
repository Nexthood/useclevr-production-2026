import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Award, Calendar, ChartLine, Lightbulb, Star, Target, Users } from "lucide-react"
import Link from "next/link"

const sessionTypes = [
  {
    icon: Lightbulb,
    title: "Fundraising",
    description: "Pitch deck review, investor targeting, valuation, and term sheet negotiation.",
    price: "299",
  },
  {
    icon: Target,
    title: "Growth Strategy",
    description: "Market expansion, customer acquisition, partnerships, and go-to-market planning.",
    price: "249",
  },
  {
    icon: ChartLine,
    title: "Operations",
    description: "Process optimization, team structuring, supply chain, and operational efficiency.",
    price: "349",
  },
  {
    icon: Award,
    title: "Financial Planning",
    description: "Cash flow management, budgeting, unit economics, and financial modeling.",
    price: "399",
  },
  {
    icon: Star,
    title: "Product Development",
    description: "Product-market fit, roadmap prioritization, features, and user experience.",
    price: "279",
  },
]

export default function MentoringPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <PublicPageHeader
        title="Business Mentoring"
        description="Book one-on-one expert sessions tailored to your business stage — from pre-seed fundraising to scale-up operations."
      />

      <section className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground">How It Works</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Choose a topic, pick an expert mentor, and book a 60-minute video session. Get actionable
              advice specific to your business data and goals.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="mt-3">Choose a Mentor</CardTitle>
                <CardDescription>
                  Browse vetted experts with startup, SME, and industry experience. Each mentor
                  specializes in specific areas.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="mt-3">Book a Session</CardTitle>
                <CardDescription>
                  Pick a time that works for you. Sessions are 60 minutes via video call with
                  personalized preparation from your mentor.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ChartLine className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="mt-3">Get Results</CardTitle>
                <CardDescription>
                  Leave with actionable next steps, templates, and resources. Follow-up materials
                  are shared after each session.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">Session Types</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sessionTypes.map((type) => (
              <Card key={type.title}>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <type.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="mt-3">{type.title}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </CardHeader>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">From €{type.price}</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border bg-card p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold text-foreground">Ready to grow your business?</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Sign in to browse mentors and book your first session. Already have a UseClevr
              account? Head to your dashboard.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-background px-8 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
