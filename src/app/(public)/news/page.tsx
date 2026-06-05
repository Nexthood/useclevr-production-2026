import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicPageHeader } from "@/components/layout/public-page-header"
import { Card } from "@/components/ui/card"
import { getNewsPosts } from "@/lib/payload/content"
import Link from "next/link"

export const metadata = {
  title: "News - UseClevr",
  description: "Product news and launch-readiness updates from UseClevr.",
}

export default async function NewsPage() {
  const posts = await getNewsPosts(20)

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <PublicPageHeader
          title="News"
          description="Product updates, release notes, and launch-readiness highlights."
        />
        <section className="container mx-auto px-4 py-12 md:px-6">
          <div className="mx-auto grid max-w-5xl gap-6">
            {posts.map((post) => (
              <Card key={post.id} className="border-border/60 p-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {new Date(post.publishedAt).toLocaleDateString()}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">
                  <Link href={`/news/${post.slug}`} className="hover:text-primary">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
