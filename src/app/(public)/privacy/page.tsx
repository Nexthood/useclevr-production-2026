import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { getPrivacyContent, renderParagraphs } from "@/lib/payload/content"

export const metadata = {
  title: "Privacy Policy - UseClevr",
  description: "Privacy policy for UseClevr",
}

export default async function PrivacyPolicyPage() {
  const page = await getPrivacyContent()

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <PublicPageHeader title={page.title} description={page.lastUpdatedLabel} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="space-y-5 text-base leading-8 text-muted-foreground">
          <p className="text-lg text-foreground">{page.description}</p>
          {renderParagraphs(page.content).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
