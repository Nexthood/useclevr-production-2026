import { Card } from "@/components/ui/card"
import type { FaqCategory } from "@/lib/content/faq"

export function FaqList({ categories }: { categories: FaqCategory[] }) {
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <section key={category.category} className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {category.category}
          </h2>
          <div className="grid gap-3">
            {category.items.map((item) => (
              <Card key={item.q} className="p-4">
                <h3 className="font-medium text-foreground">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
