import { auth } from "@/lib/auth/auth";
import { buildUsyReply, roleFromAudience } from "@/lib/usy/router";
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
    usage: z
      .object({
        subscriptionTier: z.string().optional(),
        analysisCount: z.number().optional(),
        total: z.number().optional(),
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
      message: z.string().optional(),
      senderName: z.string().optional(),
      company: z.string().optional(),
      replyEmail: z.string().optional(),
      language: z.enum(["english", "german", "dutch", "spanish", "hungarian", "romanian"]).optional(),
      awaitingConfirmation: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

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
  const role = roleFromAudience(audience, session?.user?.role ?? null);
  const response = buildUsyReply({
    question: parsed.data.question,
    context: {
      audience,
      role,
      route: parsed.data.context.route,
      plan: parsed.data.context.plan || parsed.data.context.usage?.subscriptionTier,
      usage: parsed.data.context.usage ?? null,
    },
    contactDraft: parsed.data.contactDraft as UsyContactDraft | null | undefined,
  });

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
