import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveNewsPrimaryCtaHref } from "../../src/lib/public/news-cta-routing";

function run() {
  assert.equal(resolveNewsPrimaryCtaHref(true), "/app", "authenticated news CTA opens the app entry");
  assert.equal(resolveNewsPrimaryCtaHref(false), "/signup", "anonymous news CTA keeps the existing signup flow");

  const newsPage = readFileSync("src/app/(public)/news/page.tsx", "utf8");
  assert.ok(newsPage.includes("await auth()"), "news page reuses the existing auth session mechanism");
  assert.ok(newsPage.includes("resolveNewsPrimaryCtaHref(Boolean(session))"), "news page resolves the CTA from authenticated state");
  assert.ok(newsPage.includes("href={primaryCtaHref}"), "news CTA uses the auth-aware href");
  assert.equal(
    newsPage.match(/Start finding hidden insight/g)?.length,
    1,
    "news page has one Start finding hidden insight CTA",
  );
}

run();
console.log("News auth-aware CTA regression tests passed.");
