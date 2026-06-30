import { AiProvidersClient } from "@/app/(auth)/app/settings/ai-providers/ai-providers-client";
import { listPublicAiProviderConfigs } from "@/lib/ai/byoai-provider";
import { auth } from "@/lib/auth/auth";
import { debugError } from "@/lib/utils/debug";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Providers" };

export default async function AiProvidersSettingsPage() {
  const session = await auth();
  let providers: Awaited<ReturnType<typeof listPublicAiProviderConfigs>> = [];
  let loadError: string | null = null;

  if (session?.user?.id) {
    try {
      providers = await listPublicAiProviderConfigs(session.user.id);
    } catch (error) {
      loadError = "AI provider settings need the latest database migration before saved providers can load.";
      debugError("[AI_PROVIDER] Failed to load provider settings page", error);
    }
  }

  return <AiProvidersClient providers={providers} loadError={loadError} />;
}
