import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { getTermsContent, renderParagraphs } from "@/lib/payload/content"

export const metadata = {
  title: "Terms of Service - UseClevr",
  description: "Terms and conditions for using UseClevr",
}

export default async function TermsPage() {
  const page = await getTermsContent()

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <PublicPageHeader title={page.title} description={page.lastUpdatedLabel} />
        <section className="container mx-auto px-4 py-12 md:px-6">
          <div className="mx-auto max-w-3xl space-y-5 text-base leading-8 text-muted-foreground">
            <p className="text-lg text-foreground">{page.description}</p>
            {renderParagraphs(page.content).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
