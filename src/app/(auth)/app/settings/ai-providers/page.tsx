import { AiProvidersClient } from "@/app/(auth)/app/settings/ai-providers/ai-providers-client";
import { listPublicAiProviderConfigs } from "@/lib/ai/byoai-provider";
import { auth } from "@/lib/auth/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Providers" };

export default async function AiProvidersSettingsPage() {
  const session = await auth();
  const providers = session?.user?.id ? await listPublicAiProviderConfigs(session.user.id) : [];

  return <AiProvidersClient providers={providers} />;
}
