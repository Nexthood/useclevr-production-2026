import { auth } from "@/lib/auth/auth";
import { buildUsyReply, buildUsyRequestContext, roleFromAudience } from "@/lib/usy/router";
import type { HelpChatboxAudience, UsyContactDraft } from "@/lib/usy/types";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const audienceSchema = z.enum(["public", "dashboard", "superadmin"]);
const chatSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  context: z.object({
    audience: audienceSchema.default("public"),
    route: z.string().trim().max(300).default("/"),
    plan: z.string().trim().max(80).optional(),
    currency: z.string().trim().length(3).optional(),
    usage: z
      .object({
        subscriptionTier: z.string().optional(),
        analysisCount: z.number().optional(),
        total: z.number().optional(),
        includedBalance: z.number().optional(),
        purchasedBalance: z.number().optional(),
        availableCredits: z.number().optional(),
        remainingCredits: z.number().optional(),
        limitReached: z.boolean().optional(),
        unlimited: z.boolean().optional(),
        unlimitedLabel: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  contactDraft: z
    .object({
      category: z.enum(["sales", "technical_support", "billing", "management", "executive"]).optional(),
      message: z.string().max(2000).optional(),
      senderName: z.string().max(120).optional(),
      company: z.string().max(120).optional(),
      replyEmail: z.string().max(254).optional(),
      language: z.enum(["english", "german", "dutch", "spanish", "hungarian", "romanian"]).optional(),
      awaitingConfirmation: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

// Authenticated drafts are completed from the verified server session, never
// from client-claimed identity: missing name and reply email are prefilled
// only for the signed-in user's own contact request.
function withSessionContactDefaults(
  draft: z.infer<typeof chatSchema>["contactDraft"],
  user: { name?: string | null; email?: string | null } | undefined,
) {
  if (!draft || !user) return draft;
  return {
    ...draft,
    senderName: draft.senderName?.trim() ? draft.senderName : user.name?.trim() || undefined,
    replyEmail: draft.replyEmail?.trim() ? draft.replyEmail : user.email?.trim() || undefined,
  };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  const session = await auth();
  const rateLimitKey = session?.user?.id ? `user:${session.user.id}` : `ip:${ip}`;

  if (!checkRateLimit(`usy-chat:${rateLimitKey}`, 30, 60 * 1000)) {
    return NextResponse.json(
      { error: "Usy is receiving too many requests. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid Usy request." }, { status: 400 });
  }

  const audience = parsed.data.context.audience as HelpChatboxAudience;
  // Identity and role come only from the verified server session; guests are
  // always public regardless of any client-supplied audience.
  const sessionRole = session?.user?.role ?? null;
  const isAuthenticated = Boolean(session?.user?.id);
  const role = roleFromAudience(audience, sessionRole);
  const context = buildUsyRequestContext({
    audience,
    role,
    route: parsed.data.context.route,
    isAuthenticated,
    clientPlan: parsed.data.context.plan,
    clientUsage: parsed.data.context.usage ?? null,
    clientCurrency: parsed.data.context.currency ?? null,
  });
  const response = buildUsyReply({
    question: parsed.data.question,
    context,
    contactDraft: withSessionContactDefaults(parsed.data.contactDraft, session?.user) as UsyContactDraft | null | undefined,
  });

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
