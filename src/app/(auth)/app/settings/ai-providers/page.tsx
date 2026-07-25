import { AiProvidersClient } from "@/app/(auth)/app/settings/ai-providers/ai-providers-client";
import { getAiMode, getUseClevrCloudFallbackAllowed, listPublicAiProviderConfigs, toPublicAiMode, type AiMode } from "@/lib/ai/byoai-provider";
import { auth } from "@/lib/auth/auth";
import { getHybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate";
import { debugError } from "@/lib/utils/debug";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Providers" };

export default async function AiProvidersSettingsPage() {
  const session = await auth();
  let providers: Awaited<ReturnType<typeof listPublicAiProviderConfigs>> = [];
  let aiMode: AiMode = "automatic";
  let allowUseClevrCloudFallback = true;
  let featureAccess: Awaited<ReturnType<typeof getHybridAiFeatureAccess>> | null = null;
  let loadError: string | null = null;

  if (session?.user?.id) {
    try {
      featureAccess = await getHybridAiFeatureAccess(session.user.id, session.user.role, session.user.email);
    } catch (error) {
      debugError("[AI_PROVIDER] Failed to load Hybrid AI entitlement", error);
    }

    try {
      [providers, aiMode, allowUseClevrCloudFallback] = await Promise.all([
        listPublicAiProviderConfigs(session.user.id),
        getAiMode(session.user.id).then(toPublicAiMode),
        getUseClevrCloudFallbackAllowed(session.user.id),
      ]);
    } catch (error) {
      loadError = "AI provider settings need the latest database migration before saved providers can load.";
      debugError("[AI_PROVIDER] Failed to load provider settings page", error);
    }
  }

  return <AiProvidersClient providers={providers} aiMode={aiMode} allowUseClevrCloudFallback={allowUseClevrCloudFallback} featureAccess={featureAccess} loadError={loadError} />;
}
