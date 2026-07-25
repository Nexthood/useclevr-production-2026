"use client";

import { deleteAiProvider, saveAiProvider, updateAiMode, updateAiProviderRouting } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotice } from "@/components/ui/notice-bar";
import type { AiMode, PublicAiProviderConfig } from "@/lib/ai/byoai-provider";
import type { HybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate";
import {
  CheckCircle2,
  Clock3,
  ListChecks,
  Plus,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

type ProviderType =
  | "ollama"
  | "openai_compatible"
  | "openai"
  | "anthropic"
  | "google_gemini";

const providerTypes: Array<{
  value: ProviderType;
  label: string;
  baseUrl: string;
  placeholderModel: string;
  keyOptional: boolean;
}> = [
  { value: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", placeholderModel: "llama3.1", keyOptional: true },
  { value: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", placeholderModel: "gpt-4o-mini", keyOptional: false },
  { value: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com", placeholderModel: "claude-3-5-sonnet-latest", keyOptional: false },
  { value: "google_gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", placeholderModel: "gemini-2.5-flash", keyOptional: false },
  { value: "openai_compatible", label: "OpenAI-compatible", baseUrl: "https://api.example.com/v1", placeholderModel: "model-name", keyOptional: false },
];

type FormState = {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
  isFallback: boolean;
  priority: number;
};

const emptyForm: FormState = {
  providerId: "",
  providerName: "",
  providerType: "openai_compatible",
  baseUrl: "https://api.example.com/v1",
  modelName: "",
  apiKey: "",
  enabled: true,
  isDefault: false,
  isFallback: false,
  priority: 100,
};

type HealthCheckResult = {
  success?: boolean;
};

export function AiProvidersClient({
  providers,
  aiMode,
  allowUseClevrCloudFallback,
  featureAccess,
  loadError,
}: {
  providers: PublicAiProviderConfig[];
  aiMode: AiMode;
  allowUseClevrCloudFallback: boolean;
  featureAccess: HybridAiFeatureAccess | null;
  loadError?: string | null;
}) {
  const router = useRouter();
  const { showNotice } = useNotice();
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [upgradeDialog, setUpgradeDialog] = React.useState<{ title: string; message: string; requiredTier: "lite" | "mega" } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingRouting, setIsSavingRouting] = React.useState(false);
  const [isSavingMode, setIsSavingMode] = React.useState(false);
  const [isDeletingProvider, setIsDeletingProvider] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    status?: string;
    message: string;
    latencyMs?: number;
    availableModels?: string[];
    modelConfirmed?: boolean;
  } | null>(null);

  const defaultProvider = providers.find((provider) => provider.isDefault) || providers[0] || null;
  const fallbackProvider = providers.find((provider) => provider.isFallback) || null;
  const enabledCount = providers.filter((provider) => provider.enabled).length;
  const localProviderCount = providers.filter((provider) => isLocalProviderType(provider.providerType)).length;
  const typeMeta = providerTypes.find((type) => type.value === form.providerType) || providerTypes[2];
  const savedProvider = providers.find((provider) => provider.id === form.providerId);
  const canUseAiProviders = Boolean(featureAccess?.enabledFeatureIds.includes("aiProviderManagement"));
  const canUseModeRouting = Boolean(
    featureAccess?.enabledFeatureIds.includes("autoMode") &&
      featureAccess.enabledFeatureIds.includes("localMode") &&
      featureAccess.enabledFeatureIds.includes("cloudMode"),
  );
  const providerLimit = featureAccess?.providerLimit ?? 0;
  const canAddProvider = canUseAiProviders && (providerLimit === null || providers.length < providerLimit);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function openNewDialog() {
    if (!canUseAiProviders) {
      openUpgradeDialog("lite", "AI Providers require Hybrid AI Lite.", "Upgrade to Pro or Business to connect your own AI provider.");
      return;
    }
    if (!canAddProvider) {
      openUpgradeDialog("mega", "Hybrid AI Lite includes one AI provider.", "Upgrade to Hybrid AI MEGA to connect multiple providers and unlock enterprise modules.");
      return;
    }
    setForm(emptyForm);
    setTestResult(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(provider: PublicAiProviderConfig) {
    if (!canUseAiProviders) {
      openUpgradeDialog("lite", "AI Providers require Hybrid AI Lite.", "Upgrade to Pro or Business to edit provider settings.");
      return;
    }
    setForm(formFromProvider(provider));
    setTestResult(null);
    setIsDialogOpen(true);
  }

  function handleProviderTypeChange(value: ProviderType) {
    const meta = providerTypes.find((type) => type.value === value) || providerTypes[2];
    updateForm({
      providerType: value,
      baseUrl: form.providerId ? form.baseUrl : meta.baseUrl,
      modelName: form.modelName,
    });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseAiProviders) {
      openUpgradeDialog("lite", "AI Providers require Hybrid AI Lite.", "Upgrade to Pro or Business to save provider settings.");
      return;
    }
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    if (!form.apiKey.trim()) formData.delete("apiKey");

    const result = await saveAiProvider(formData);
    if (!result.success) {
      showNotice({ type: "error", title: "AI provider was not saved.", message: result.error });
    } else {
      showNotice({ type: "success", title: "AI provider saved.", message: "UseClevr will route analysis through enabled providers first." });
      setIsDialogOpen(false);
      setForm(emptyForm);
      router.refresh();
    }
    setIsSaving(false);
  }

  async function handleRoutingSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseAiProviders) {
      openUpgradeDialog("lite", "AI routing requires Hybrid AI Lite.", "Upgrade to Pro or Business to configure provider routing.");
      return;
    }
    setIsSavingRouting(true);
    const result = await updateAiProviderRouting(new FormData(event.currentTarget));
    if (!result.success) {
      showNotice({ type: "error", title: "Routing was not saved.", message: result.error });
    } else {
      showNotice({ type: "success", title: "AI routing saved.", message: "Default and fallback providers were updated." });
      router.refresh();
    }
    setIsSavingRouting(false);
  }

  async function handleModeSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseModeRouting) {
      openUpgradeDialog("lite", "Hybrid AI modes require Hybrid AI Lite.", "Upgrade to Pro or Business to use Auto, Local only, and Cloud only modes.");
      return;
    }
    setIsSavingMode(true);
    const result = await updateAiMode(new FormData(event.currentTarget));
    if (!result.success) {
      showNotice({ type: "error", title: "AI mode was not saved.", message: result.error });
    } else {
      showNotice({ type: "success", title: "AI mode saved.", message: modeNoticeMessage(String(new FormData(event.currentTarget).get("aiMode") || "auto") as AiMode) });
      router.refresh();
    }
    setIsSavingMode(false);
  }

  async function handleDeleteProvider() {
    if (!form.providerId) return;
    if (!window.confirm("Delete this AI provider? The saved credential is removed.")) return;
    setIsDeletingProvider(true);
    const formData = new FormData();
    formData.set("providerId", form.providerId);
    const result = await deleteAiProvider(formData);
    if (!result.success) {
      showNotice({ type: "error", title: "AI provider was not deleted.", message: result.error });
    } else {
      showNotice({ type: "success", title: "AI provider deleted.", message: "The provider and saved credential were removed." });
      setIsDialogOpen(false);
      setForm(emptyForm);
      router.refresh();
    }
    setIsDeletingProvider(false);
  }

  async function handleTest() {
    if (!canUseAiProviders) {
      openUpgradeDialog("lite", "Provider testing requires Hybrid AI Lite.", "Upgrade to Pro or Business to test provider connections.");
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/ai-providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.providerId || undefined,
          providerName: form.providerName,
          providerType: form.providerType,
          baseUrl: form.baseUrl,
          modelName: form.modelName,
          apiKey: form.apiKey.trim() || undefined,
          useSavedKey: !form.apiKey.trim() && Boolean(savedProvider?.hasApiKey),
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        const message = body.error || "Connection failed.";
        setTestResult({ success: false, status: body.status, message, modelConfirmed: false });
        showNotice({ type: "error", title: "Provider connection failed.", message });
        return;
      }

      const message = `Connected in ${body.latencyMs} ms.`;
      setTestResult({
        success: true,
        status: body.status,
        message,
        latencyMs: body.latencyMs,
        availableModels: Array.isArray(body.availableModels) ? body.availableModels : [],
        modelConfirmed: body.modelConfirmed === true,
      });
      showNotice({ type: "success", title: "Provider connected.", message });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      setTestResult({ success: false, message });
      showNotice({ type: "error", title: "Provider connection failed.", message });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleHealthCheck() {
    if (!canUseAiProviders) {
      openUpgradeDialog("lite", "Provider health checks require Hybrid AI Lite.", "Upgrade to Pro or Business to check provider availability.");
      return;
    }
    setIsCheckingHealth(true);
    try {
      const response = await fetch("/api/ai-providers/health", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        const message = body.error || "Provider health check failed.";
        showNotice({ type: "error", title: "Health check failed.", message });
        return;
      }

      const results: HealthCheckResult[] = Array.isArray(body.results) ? body.results : [];
      const healthy = results.filter((result) => result?.success).length;
      const failed = results.length - healthy;
      showNotice({
        type: failed > 0 ? "info" : "success",
        title: "Provider health checked.",
        message: `${healthy} healthy, ${failed} unavailable.`,
      });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider health check failed.";
      showNotice({ type: "error", title: "Health check failed.", message });
    } finally {
      setIsCheckingHealth(false);
    }
  }

  function openUpgradeDialog(requiredTier: "lite" | "mega", title: string, message: string) {
    setUpgradeDialog({ requiredTier, title, message });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <PlugZap className="h-3.5 w-3.5" />
              Bring Your Own AI
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">AI Providers</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Connect existing AI engines and route UseClevr analysis through your default provider with automatic fallback.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <StatusTile label="Providers" value={String(providers.length)} />
            <StatusTile label="Enabled" value={String(enabledCount)} />
            <StatusTile label="Plan limit" value={providerLimit === null ? "Unlimited" : String(providerLimit)} />
          </div>
        </div>
      </section>

      {!canUseAiProviders ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">AI Providers require Hybrid AI Lite.</p>
              <p className="mt-1">Upgrade to Pro or Business to connect your own local or cloud AI provider.</p>
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4" />
            <p>{loadError}</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Provider list</CardTitle>
                  <CardDescription>API keys stay encrypted server-side and are never returned to the browser.</CardDescription>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={handleHealthCheck} disabled={isCheckingHealth || enabledCount === 0 || !canUseAiProviders} className="gap-2 bg-transparent">
                  <ListChecks className="h-4 w-4" />
                  {isCheckingHealth ? "Checking..." : "Check enabled"}
                </Button>
                <Button type="button" onClick={openNewDialog} className="gap-2 bg-gradient-primary hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  {canAddProvider ? "Add provider" : "Upgrade for more"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {providers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background/70 p-6">
                <p className="font-medium text-foreground">No providers connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a local or cloud provider to use Bring Your Own AI for analysis, reports, and assistant answers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <div className="min-w-[780px]">
                  <div className="grid grid-cols-[minmax(190px,1.4fr)_minmax(150px,1fr)_90px_120px_120px] gap-3 border-b border-border bg-muted/60 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                    <span>Provider</span>
                    <span>Model</span>
                    <span>Priority</span>
                    <span>Status</span>
                    <span className="text-right">Action</span>
                  </div>
                  <div className="divide-y divide-border">
                    {providers.map((provider) => (
                      <div
                        key={provider.id}
                        className="grid grid-cols-[minmax(190px,1.4fr)_minmax(150px,1fr)_90px_120px_120px] items-center gap-3 px-4 py-4 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">{provider.providerName}</p>
                            {provider.isDefault ? <Pill tone="primary">Default</Pill> : null}
                            {provider.isFallback ? <Pill tone="muted">Fallback</Pill> : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{labelForType(provider.providerType)} · {provider.baseUrl}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{provider.modelName}</p>
                          {provider.hasApiKey ? (
                            <p className="text-xs text-muted-foreground">{provider.apiKeyPreview || "Saved key"}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No API key</p>
                          )}
                        </div>
                        <p className="text-muted-foreground">{provider.priority}</p>
                        <ProviderStatus provider={provider} />
                        <div className="text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(provider)} className="bg-transparent">
                            Edit
                          </Button>
                        </div>
                        {provider.lastTestModels.length > 0 ? (
                          <div className="col-span-5 -mt-1 flex flex-wrap gap-1.5">
                            {provider.lastTestModels.slice(0, 10).map((model) => (
                              <span key={model} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{model}</span>
                            ))}
                          </div>
                        ) : null}
                        {provider.lastTestMessage ? (
                          <p className="col-span-5 text-xs text-muted-foreground">{provider.lastTestMessage}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                <PlugZap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>AI mode</CardTitle>
                <CardDescription>Control when UseClevr can use local or cloud AI.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleModeSave} className="space-y-4">
              <div className="grid gap-3">
                <ModeOption
                  value="automatic"
                  current={aiMode}
                  title="Automatic"
                  description="Uses privacy, task complexity, local availability, provider priority, and cloud fallback settings."
                />
                <ModeOption
                  value="local"
                  current={aiMode}
                  title="Local AI"
                  description="Runs on your device. Data stays local unless cloud fallback is enabled."
                />
                <ModeOption
                  value="byok"
                  current={aiMode}
                  title="BYOK"
                  description="Use your own provider account and API billing."
                />
                <ModeOption
                  value="useclevr_cloud"
                  current={aiMode}
                  title="UseClevr Cloud"
                  description="Managed AI provided by UseClevr."
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 p-3">
                <input
                  type="checkbox"
                  name="allowUseclevrCloudFallback"
                  defaultChecked={allowUseClevrCloudFallback}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">Allow UseClevr Cloud fallback</span>
                  <span className="mt-1 block text-xs text-muted-foreground">When enabled, UseClevr Cloud can handle requests only after the selected routing path allows cloud fallback.</span>
                </span>
              </label>

              {aiMode === "local" || aiMode === "local-only" ? (
                <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-800 dark:text-sky-200">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Offline mode active</span>
                </div>
              ) : null}

              {(aiMode === "local" || aiMode === "local-only") && localProviderCount === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Offline mode needs at least one enabled local provider before analysis can run.
                </div>
              ) : null}

              <Button type="submit" disabled={isSavingMode} className="w-full bg-gradient-primary hover:opacity-90">
                {isSavingMode ? "Saving..." : canUseModeRouting ? "Save AI mode" : "Upgrade for modes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Routing</CardTitle>
                <CardDescription>Select the primary and fallback provider.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRoutingSave} className="space-y-4">
              <Field label="Default provider" htmlFor="defaultProviderId">
                <select
                  id="defaultProviderId"
                  name="defaultProviderId"
                  defaultValue={defaultProvider?.id || ""}
                  className="h-11 w-full rounded-md border border-input bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Cloud fallback</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.providerName}</option>
                  ))}
                </select>
              </Field>

              {providerLimit === 1 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Hybrid AI Lite uses one AI provider. Upgrade to MEGA to configure a second provider as fallback.
                </div>
              ) : (
                <Field label="Fallback provider" htmlFor="fallbackProviderId">
                  <select
                    id="fallbackProviderId"
                    name="fallbackProviderId"
                    defaultValue={fallbackProvider?.id || ""}
                    className="h-11 w-full rounded-md border border-input bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Default cloud AI</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.providerName}</option>
                    ))}
                  </select>
                </Field>
              )}

              <div className="rounded-lg border border-border bg-background/70 p-3 text-sm">
                <p className="font-medium text-foreground">Current path</p>
                <p className="mt-1 text-muted-foreground">
                  {defaultProvider ? defaultProvider.providerName : "Cloud fallback"}
                  {fallbackProvider ? `, then ${fallbackProvider.providerName}` : ", then default cloud AI"}
                </p>
              </div>

              <Button type="submit" disabled={isSavingRouting || providers.length === 0} className="w-full bg-gradient-primary hover:opacity-90">
                {isSavingRouting ? "Saving..." : canUseAiProviders ? "Save routing" : "Upgrade for routing"}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </section>

      {isDialogOpen ? (
        <ProviderDialog
          form={form}
          typeMeta={typeMeta}
          savedProvider={savedProvider}
          testResult={testResult}
          isSaving={isSaving}
          isDeleting={isDeletingProvider}
          isTesting={isTesting}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSave}
          onDelete={handleDeleteProvider}
          onTest={handleTest}
          onUpdate={updateForm}
          onProviderTypeChange={handleProviderTypeChange}
        />
      ) : null}

      {upgradeDialog ? (
        <UpgradeGateDialog
          title={upgradeDialog.title}
          message={upgradeDialog.message}
          requiredTier={upgradeDialog.requiredTier}
          onClose={() => setUpgradeDialog(null)}
        />
      ) : null}
    </div>
  );
}

function ProviderDialog({
  form,
  typeMeta,
  savedProvider,
  testResult,
  isSaving,
  isDeleting,
  isTesting,
  onClose,
  onSave,
  onDelete,
  onTest,
  onUpdate,
  onProviderTypeChange,
}: {
  form: FormState;
  typeMeta: (typeof providerTypes)[number];
  savedProvider?: PublicAiProviderConfig;
  testResult: { success: boolean; status?: string; message: string; latencyMs?: number; availableModels?: string[]; modelConfirmed?: boolean } | null;
  isSaving: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onTest: () => void;
  onUpdate: (patch: Partial<FormState>) => void;
  onProviderTypeChange: (value: ProviderType) => void;
}) {
  const isBaseUrlEditable = form.providerType === "ollama" || form.providerType === "openai_compatible";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{form.providerId ? "Edit provider" : "Add provider"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Configure a local or cloud AI endpoint for UseClevr analysis.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close provider dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={onSave} className="space-y-5 p-5">
          <input type="hidden" name="providerId" value={form.providerId} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider name" htmlFor="providerName">
              <Input
                id="providerName"
                name="providerName"
                value={form.providerName}
                onChange={(event) => onUpdate({ providerName: event.target.value })}
                placeholder="Local analysis engine"
                className="h-11 bg-muted"
                required
              />
            </Field>

            <Field label="Provider type" htmlFor="providerType">
              <select
                id="providerType"
                name="providerType"
                value={form.providerType}
                onChange={(event) => onProviderTypeChange(event.target.value as ProviderType)}
                className="h-11 w-full rounded-md border border-input bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {providerTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {isBaseUrlEditable ? (
            <Field label="Base URL" htmlFor="baseUrl">
              <Input
                id="baseUrl"
                name="baseUrl"
                value={form.baseUrl}
                onChange={(event) => onUpdate({ baseUrl: event.target.value })}
                placeholder={typeMeta.baseUrl}
                className="h-11 bg-muted font-mono text-sm"
                required
              />
            </Field>
          ) : (
            <input type="hidden" name="baseUrl" value={form.baseUrl || typeMeta.baseUrl} />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Model" htmlFor="modelName">
              <Input
                id="modelName"
                name="modelName"
                value={form.modelName}
                onChange={(event) => onUpdate({ modelName: event.target.value })}
                placeholder={typeMeta.placeholderModel}
                className="h-11 bg-muted"
                required
              />
            </Field>

            <Field label={savedProvider?.hasApiKey ? "Replace key" : typeMeta.keyOptional ? "API key optional" : "API key"} htmlFor="apiKey">
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                value={form.apiKey}
                onChange={(event) => onUpdate({ apiKey: event.target.value })}
                placeholder={savedProvider?.hasApiKey ? "Saved key hidden" : typeMeta.keyOptional ? "Not required for Ollama" : "Required"}
                className="h-11 bg-muted"
                autoComplete="off"
              />
              {savedProvider?.hasApiKey ? (
                <p className="mt-1 text-xs text-muted-foreground">Saved key: masked. Enter a new key only when replacing it.</p>
              ) : null}
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <Field label="Priority" htmlFor="priority">
              <Input
                id="priority"
                name="priority"
                type="number"
                min={0}
                max={999}
                value={form.priority}
                onChange={(event) => onUpdate({ priority: Number(event.target.value) })}
                className="h-11 bg-muted"
              />
            </Field>
            <div className="rounded-lg border border-border bg-background/70 p-3 text-xs text-muted-foreground">
              Lower priority runs earlier after default and fallback providers.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <CheckboxRow name="enabled" checked={form.enabled} onChange={(checked) => onUpdate({ enabled: checked })} title="Enabled" description="Allow routing." />
            <CheckboxRow name="isDefault" checked={form.isDefault} onChange={(checked) => onUpdate({ isDefault: checked, isFallback: checked ? false : form.isFallback })} title="Default" description="Try first." />
            <CheckboxRow name="isFallback" checked={form.isFallback} onChange={(checked) => onUpdate({ isFallback: checked, isDefault: checked ? false : form.isDefault })} title="Fallback" description="Try second." />
          </div>

          {testResult ? (
            <ConnectionResult
              success={testResult.success}
              message={testResult.message}
              latencyMs={testResult.latencyMs}
              models={testResult.availableModels || []}
              modelConfirmed={testResult.modelConfirmed === true}
              status={testResult.status}
            />
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
            <Button type="submit" disabled={isSaving || isDeleting} className="bg-gradient-primary hover:opacity-90">
              {isSaving ? "Saving..." : "Save provider"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isTesting || !form.providerName || !form.baseUrl || !form.modelName}
              onClick={onTest}
              className="bg-transparent"
            >
              {isTesting ? "Testing..." : "Test connection"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            {form.providerId ? (
              <Button type="button" variant="outline" disabled={isDeleting || isSaving} onClick={onDelete} className="ml-auto gap-2 border-red-500/30 bg-transparent text-red-600 hover:bg-red-500/10 dark:text-red-300">
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function UpgradeGateDialog({
  title,
  message,
  requiredTier,
  onClose,
}: {
  title: string;
  message: string;
  requiredTier: "lite" | "mega";
  onClose: () => void;
}) {
  const planId = requiredTier === "mega" ? "business_monthly" : "pro_monthly";
  const label = requiredTier === "mega" ? "Upgrade to Business" : "Upgrade to Pro";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/app/settings/checkout?plan=${planId}`}
            onClick={onClose}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {label}
          </Link>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}

function formFromProvider(provider: PublicAiProviderConfig): FormState {
  const providerType = normalizeProviderTypeForForm(provider.providerType);
  return {
    providerId: provider.id,
    providerName: provider.providerName,
    providerType,
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    apiKey: "",
    enabled: provider.enabled,
    isDefault: provider.isDefault,
    isFallback: provider.isFallback,
    priority: provider.priority,
  };
}

function normalizeProviderTypeForForm(value: string): ProviderType {
  if (value === "openai-compatible") return "openai_compatible";
  if (value === "google-gemini") return "google_gemini";
  if (value === "ollama" || value === "openai" || value === "anthropic" || value === "google_gemini" || value === "openai_compatible") {
    return value;
  }
  return "openai_compatible";
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CheckboxRow({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 p-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function ModeOption({
  value,
  current,
  title,
  description,
}: {
  value: AiMode;
  current: AiMode;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 p-3">
      <input
        type="radio"
        name="aiMode"
        value={value}
        defaultChecked={current === value}
        className="mt-1 h-4 w-4 border-border"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function ConnectionResult({
  success,
  message,
  latencyMs,
  models,
  modelConfirmed,
  status,
}: {
  success: boolean;
  message: string;
  latencyMs?: number;
  models: string[];
  modelConfirmed?: boolean;
  status?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${success ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
      <div className="flex items-start gap-2">
        {success ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <TriangleAlert className="mt-0.5 h-4 w-4 text-red-600" />}
        <div>
          <p className={success ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-red-700 dark:text-red-300"}>
            {success ? "Connected" : "Error"}
          </p>
          <p className="mt-1 text-muted-foreground">{message}</p>
          {latencyMs ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Latency {latencyMs} ms
            </p>
          ) : null}
          {success && modelConfirmed ? (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">Model confirmed</p>
          ) : null}
          {!success && status ? (
            <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">{statusLabel(status)}</p>
          ) : null}
          {models.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {models.slice(0, 12).map((model) => (
                <span key={model} className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{model}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProviderStatus({ provider }: { provider: PublicAiProviderConfig }) {
  const status = normalizeHealthStatus(provider.lastTestStatus);
  const lastChecked = provider.lastTestedAt ? `Checked ${formatDateTime(provider.lastTestedAt)}` : null;

  if (provider.isFallback && isHealthyStatus(provider.lastTestStatus)) {
    return (
      <div className="text-emerald-600 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Fallback ready</span>
        </div>
        {lastChecked ? <p className="mt-1 text-xs text-muted-foreground">{lastChecked}</p> : null}
      </div>
    );
  }

  if (status === "connected" || status === "healthy") {
    return (
      <div className="text-emerald-600 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{provider.lastTestLatencyMs ? `Healthy ${provider.lastTestLatencyMs} ms` : "Healthy"}</span>
        </div>
        {lastChecked ? <p className="mt-1 text-xs text-muted-foreground">{lastChecked}</p> : null}
      </div>
    );
  }

  if (status !== "not_tested") {
    return (
      <div className="text-amber-600 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4" />
          <span>{statusLabel(status)}</span>
        </div>
        {lastChecked ? <p className="mt-1 text-xs text-muted-foreground">{lastChecked}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <ShieldCheck className="h-4 w-4" />
      <span>Not tested</span>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "primary" | "muted" }) {
  return (
    <span className={tone === "primary" ? "rounded-full bg-primary/10 px-2 py-1 text-xs text-primary" : "rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"}>
      {children}
    </span>
  );
}

function labelForType(type: string) {
  return providerTypes.find((providerType) => providerType.value === normalizeProviderTypeForForm(type))?.label || type;
}

function isLocalProviderType(type: string) {
  return type === "ollama";
}

function isHealthyStatus(status: string | null | undefined) {
  return status === "connected" || status === "healthy" || status === "success";
}

function normalizeHealthStatus(status: string | null | undefined) {
  if (status === "connected") return "connected";
  if (status === "success") return "healthy";
  if (
    status === "invalid_key" ||
    status === "model_unavailable" ||
    status === "endpoint_unreachable" ||
    status === "rate_limited" ||
    status === "provider_error" ||
    status === "configuration_error" ||
    status === "auth_failed" ||
    status === "model_missing" ||
    status === "unreachable" ||
    status === "failed" ||
    status === "healthy"
  ) {
    return status;
  }
  return "not_tested";
}

function statusLabel(status: string) {
  switch (normalizeHealthStatus(status)) {
    case "connected":
      return "Connected";
    case "healthy":
      return "Healthy";
    case "invalid_key":
    case "auth_failed":
      return "Invalid key";
    case "model_unavailable":
    case "model_missing":
      return "Model unavailable";
    case "endpoint_unreachable":
    case "unreachable":
      return "Endpoint unreachable";
    case "rate_limited":
      return "Rate limited";
    case "configuration_error":
      return "Configuration error";
    case "provider_error":
    case "failed":
      return "Error";
    default:
      return "Not tested";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function modeNoticeMessage(mode: AiMode) {
  if (mode === "local" || mode === "local-only") return "Local mode is active. Cloud fallback follows your setting.";
  if (mode === "byok") return "BYOK mode is active. Enabled providers run by default and priority.";
  if (mode === "useclevr_cloud" || mode === "cloud-only") return "UseClevr Cloud mode is active.";
  return "Automatic mode is active.";
}
