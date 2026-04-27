import { PublicHeader } from "@/components/public-header"
import { PublicFooter } from "@/components/public-footer"
import { Card } from "@/components/ui/card"
import { Shield, Lock, Database, Sparkles } from "lucide-react"

export const metadata = {
  title: "Security & Compliance - UseClevr",
  description: "How we keep your data safe and secure",
}

export default function SecurityPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/50 bg-primary/10 text-sm text-primary mb-4">
                <Shield className="h-4 w-4" />
                <span>Security & Compliance</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Built for enterprise trust</h1>
              <p className="text-lg text-muted-foreground">
                Your data security and privacy are non-negotiable. We maintain the highest standards.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className="p-8 bg-card border-border/50">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-7 w-7 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-3">SOC 2 Type II Alignment</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Our infrastructure and processes align with SOC 2 Type II security principles. Formal compliance
                      certification in progress.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-card border-border/50">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-7 w-7 text-[#06B6D4]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-3">GDPR Compliant</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Full GDPR compliance with transparent data handling, comprehensive user rights protection, and
                      immediate data deletion upon request.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-8 bg-card border-border/50">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
                    <Lock className="h-7 w-7 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-3">End-to-End Encryption</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Military-grade AES-256 encryption for data at rest. TLS 1.3 for all data in transit. Your data is
                      always protected.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-card border-border/50">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center flex-shrink-0">
                    <Database className="h-7 w-7 text-[#06B6D4]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-3">Role-Based Access Control</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Granular permissions and access controls managed through Supabase. Ensure proper data segregation
                      across teams.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-card border-border/50">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-7 w-7 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-3">Zero AI Training Policy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Your data is never used to train AI models. We never sell customer data to third parties. Your
                      information stays yours.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 bg-card border-border/50">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#06B6D4]/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-7 w-7 text-[#06B6D4]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-3">Complete Data Control</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Request full data export or complete deletion at any time. Automated data retention policies and
                      audit trails.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
