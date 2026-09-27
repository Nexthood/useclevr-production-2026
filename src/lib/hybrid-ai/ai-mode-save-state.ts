export type PublicAiMode = "automatic" | "local" | "byok" | "useclevr_cloud";

export type AiModeSaveFeedback = {
  title: string;
  message: string;
};

export type AiModeActiveProvider = {
  providerName?: string | null;
  modelName?: string | null;
} | null;

export type AiModeSaveOutcome =
  | { success: true; savedMode: PublicAiMode }
  | { success: false; error: string };

export type AiModeUiState = {
  activeMode: PublicAiMode;
  selectedMode: PublicAiMode;
  feedback: { title: string; message: string } | null;
};

export function toPublicAiModeValue(mode: string): PublicAiMode {
  if (mode === "local" || mode === "local-only") return "local";
  if (mode === "byok") return "byok";
  if (mode === "useclevr_cloud" || mode === "cloud-only") return "useclevr_cloud";
  return "automatic";
}

export function initialAiModeUiState(serverMode: string): AiModeUiState {
  const persisted = toPublicAiModeValue(serverMode);
  return { activeMode: persisted, selectedMode: persisted, feedback: null };
}

export function resolveAiModeSaveState(input: {
  activeMode: PublicAiMode;
  selectedMode: PublicAiMode;
  outcome: AiModeSaveOutcome;
  activeProvider?: AiModeActiveProvider;
}): AiModeUiState {
  if (!input.outcome.success) {
    return { activeMode: input.activeMode, selectedMode: input.activeMode, feedback: null };
  }
  const savedMode = input.outcome.savedMode;
  return {
    activeMode: savedMode,
    selectedMode: savedMode,
    feedback: getAiModeSuccessFeedback(savedMode, savedMode === "byok" ? input.activeProvider ?? null : null),
  };
}

export function getAiModeSuccessFeedback(
  mode: PublicAiMode,
  provider: AiModeActiveProvider = null,
): AiModeSaveFeedback {
  if (mode === "useclevr_cloud") {
    return {
      title: "AI mode changed to UseClevr Cloud",
      message: "UseClevr Cloud is now your active AI provider.",
    };
  }
  if (mode === "byok") {
    const providerName = provider?.providerName?.trim();
    const modelName = provider?.modelName?.trim();
    return {
      title: "AI mode changed to BYOK",
      message:
        providerName && modelName
          ? `${providerName} · ${modelName} is now your active provider.`
          : "Your enabled AI provider is now active.",
    };
  }
  if (mode === "local") {
    return {
      title: "AI mode changed to Local AI",
      message: "Local AI routing is now active.",
    };
  }
  return {
    title: "AI mode changed to Automatic",
    message: "Automatic AI routing is now active.",
  };
}

export function resolveByokActiveProvider<
  T extends {
    enabled: boolean;
    isDefault: boolean;
    providerName: string;
    modelName: string;
    providerType: string;
  },
>(providers: T[]): T | null {
  const byokProviders = providers.filter((provider) => provider.enabled && isByokProviderTypeValue(provider.providerType));
  return byokProviders.find((provider) => provider.isDefault) || byokProviders[0] || null;
}

export function isByokProviderTypeValue(providerType: string): boolean {
  return (
    providerType === "openai" ||
    providerType === "anthropic" ||
    providerType === "google-gemini" ||
    providerType === "google_gemini" ||
    providerType === "openai-compatible" ||
    providerType === "openai_compatible"
  );
}
