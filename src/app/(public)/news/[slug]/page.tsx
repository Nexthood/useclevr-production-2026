import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { getNewsPostBySlug, renderParagraphs } from "@/lib/payload/content"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{
    slug: string
  }>
}

export default async function NewsDetailPage({ params }: Props) {
  const { slug } = await params
  const post = await getNewsPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <PublicPageHeader
          title={post.title}
          description={new Date(post.publishedAt).toLocaleDateString()}
        />
        <section className="container mx-auto max-w-3xl px-4 py-12 md:px-6">
          <div className="space-y-5 text-base leading-8 text-muted-foreground">
            <p className="text-lg text-foreground">{post.summary}</p>
            {renderParagraphs(post.content).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
