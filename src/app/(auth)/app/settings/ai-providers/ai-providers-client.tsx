"use client";

import { saveAiProvider } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotice } from "@/components/ui/notice-bar";
import type { PublicAiProviderConfig } from "@/lib/ai/byoai-provider";
import { Bot, CheckCircle2, Clock3, PlugZap, ShieldCheck, TriangleAlert } from "lucide-react";
import * as React from "react";
import { useRouter } from "next/navigation";

type ProviderType =
  | "ollama"
  | "lm-studio"
  | "openai-compatible"
  | "openai"
  | "anthropic"
  | "google-gemini"
  | "azure-openai";

const providerTypes: Array<{ value: ProviderType; label: string; baseUrl: string; placeholderModel: string; keyOptional: boolean }> = [
  { value: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", placeholderModel: "llama3.1", keyOptional: true },
  { value: "lm-studio", label: "LM Studio", baseUrl: "http://localhost:1234/v1", placeholderModel: "local-model", keyOptional: true },
  { value: "openai-compatible", label: "OpenAI Compatible", baseUrl: "http://localhost:8000/v1", placeholderModel: "model-name", keyOptional: true },
  { value: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", placeholderModel: "gpt-4o-mini", keyOptional: false },
  { value: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com", placeholderModel: "claude-3-5-sonnet-latest", keyOptional: false },
  { value: "google-gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", placeholderModel: "gemini-2.5-flash", keyOptional: false },
  { value: "azure-openai", label: "Azure OpenAI", baseUrl: "https://your-resource.openai.azure.com", placeholderModel: "deployment-name", keyOptional: false },
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
};

const emptyForm: FormState = {
  providerId: "",
  providerName: "",
  providerType: "openai-compatible",
  baseUrl: "http://localhost:8000/v1",
  modelName: "",
  apiKey: "",
  enabled: true,
  isDefault: false,
};

export function AiProvidersClient({ providers }: { providers: PublicAiProviderConfig[] }) {
  const router = useRouter();
  const { showNotice } = useNotice();
  const defaultProvider = providers.find((provider) => provider.isDefault) || providers[0];
  const [form, setForm] = React.useState<FormState>(() => defaultProvider ? formFromProvider(defaultProvider) : emptyForm);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    availableModels?: string[];
  } | null>(null);

  const typeMeta = providerTypes.find((type) => type.value === form.providerType) || providerTypes[2];
  const savedProvider = providers.find((provider) => provider.id === form.providerId);
  const connectedCount = providers.filter((provider) => provider.lastTestStatus === "success").length;
  const enabledCount = providers.filter((provider) => provider.enabled).length;

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleProviderTypeChange(value: ProviderType) {
    const meta = providerTypes.find((type) => type.value === value) || providerTypes[2];
    updateForm({
      providerType: value,
      baseUrl: form.baseUrl && form.providerId ? form.baseUrl : meta.baseUrl,
      modelName: form.modelName,
    });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    if (!form.apiKey.trim()) formData.delete("apiKey");

    const result = await saveAiProvider(formData);
    if (!result.success) {
      showNotice({ type: "error", title: "AI provider was not saved.", message: result.error });
    } else {
      showNotice({ type: "success", title: "AI provider saved.", message: "UseClevr will route analysis through enabled providers first." });
      updateForm({ apiKey: "" });
      router.refresh();
    }
    setIsSaving(false);
  }

  async function handleTest() {
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
        setTestResult({ success: false, message });
        showNotice({ type: "error", title: "Provider connection failed.", message });
        return;
      }

      const message = `Connected in ${body.latencyMs} ms.`;
      setTestResult({
        success: true,
        message,
        latencyMs: body.latencyMs,
        availableModels: Array.isArray(body.availableModels) ? body.availableModels : [],
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
              Connect existing AI engines and let UseClevr route analysis through enabled providers with automatic fallback.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <StatusTile label="Providers" value={String(providers.length)} />
            <StatusTile label="Enabled" value={String(enabledCount)} />
            <StatusTile label="Connected" value={String(connectedCount)} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Provider configuration</CardTitle>
                <CardDescription>API keys stay encrypted server-side and are never returned to the browser.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <input type="hidden" name="providerId" value={form.providerId} />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Provider name" htmlFor="providerName">
                  <Input
                    id="providerName"
                    name="providerName"
                    value={form.providerName}
                    onChange={(event) => updateForm({ providerName: event.target.value })}
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
                    onChange={(event) => handleProviderTypeChange(event.target.value as ProviderType)}
                    className="h-11 w-full rounded-md border border-input bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {providerTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Base URL" htmlFor="baseUrl">
                <Input
                  id="baseUrl"
                  name="baseUrl"
                  value={form.baseUrl}
                  onChange={(event) => updateForm({ baseUrl: event.target.value })}
                  placeholder={typeMeta.baseUrl}
                  className="h-11 bg-muted font-mono text-sm"
                  required
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Default model" htmlFor="modelName">
                  <Input
                    id="modelName"
                    name="modelName"
                    value={form.modelName}
                    onChange={(event) => updateForm({ modelName: event.target.value })}
                    placeholder={typeMeta.placeholderModel}
                    className="h-11 bg-muted"
                    required
                  />
                </Field>

                <Field label={typeMeta.keyOptional ? "API key optional" : "API key"} htmlFor="apiKey">
                  <Input
                    id="apiKey"
                    name="apiKey"
                    type="password"
                    value={form.apiKey}
                    onChange={(event) => updateForm({ apiKey: event.target.value })}
                    placeholder={savedProvider?.hasApiKey ? "Saved key hidden. Enter a new key to replace it." : typeMeta.keyOptional ? "Optional for local engines" : "Required"}
                    className="h-11 bg-muted"
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <CheckboxRow
                  name="enabled"
                  checked={form.enabled}
                  onChange={(checked) => updateForm({ enabled: checked })}
                  title="Enable provider"
                  description="Use this provider for analysis routing."
                />
                <CheckboxRow
                  name="isDefault"
                  checked={form.isDefault}
                  onChange={(checked) => updateForm({ isDefault: checked })}
                  title="Default provider"
                  description="Try this provider before other enabled providers."
                />
              </div>

              {testResult && (
                <ConnectionResult
                  success={testResult.success}
                  message={testResult.message}
                  latencyMs={testResult.latencyMs}
                  models={testResult.availableModels || []}
                />
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={isSaving} className="bg-gradient-primary hover:opacity-90">
                  {isSaving ? "Saving..." : "Save provider"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isTesting || !form.providerName || !form.baseUrl || !form.modelName}
                  onClick={handleTest}
                  className="bg-transparent"
                >
                  {isTesting ? "Testing..." : "Test connection"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(emptyForm);
                    setTestResult(null);
                  }}
                  className="bg-transparent"
                >
                  New provider
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {providers.length === 0 ? (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="p-6">
                <p className="font-medium text-foreground">No providers connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a local or cloud provider to route UseClevr AI analysis through your own engine.
                </p>
              </CardContent>
            </Card>
          ) : (
            providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  setForm(formFromProvider(provider));
                  setTestResult(null);
                }}
                className={[
                  "w-full rounded-lg border bg-card p-4 text-left shadow-sm transition hover:bg-muted/40",
                  form.providerId === provider.id ? "border-primary" : "border-border",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{provider.providerName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {labelForType(provider.providerType)} · {provider.modelName}
                    </p>
                  </div>
                  <ProviderBadge provider={provider} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {provider.isDefault && <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">Default</span>}
                  <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </span>
                  {provider.lastTestLatencyMs ? (
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                      {provider.lastTestLatencyMs} ms
                    </span>
                  ) : null}
                </div>
                {provider.lastTestMessage && (
                  <p className="mt-3 text-sm text-muted-foreground">{provider.lastTestMessage}</p>
                )}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function formFromProvider(provider: PublicAiProviderConfig): FormState {
  return {
    providerId: provider.id,
    providerName: provider.providerName,
    providerType: provider.providerType as ProviderType,
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    apiKey: "",
    enabled: provider.enabled,
    isDefault: provider.isDefault,
  };
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

function ConnectionResult({ success, message, latencyMs, models }: { success: boolean; message: string; latencyMs?: number; models: string[] }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${success ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
      <div className="flex items-start gap-2">
        {success ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <TriangleAlert className="mt-0.5 h-4 w-4 text-red-600" />}
        <div>
          <p className={success ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-red-700 dark:text-red-300"}>
            {success ? "Connected" : "Connection failed"}
          </p>
          <p className="mt-1 text-muted-foreground">{message}</p>
          {latencyMs ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Latency {latencyMs} ms
            </p>
          ) : null}
          {models.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {models.slice(0, 12).map((model) => (
                <span key={model} className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{model}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: PublicAiProviderConfig }) {
  if (provider.lastTestStatus === "success") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  }
  if (provider.lastTestStatus === "failed") {
    return <TriangleAlert className="h-5 w-5 text-amber-500" />;
  }
  return <ShieldCheck className="h-5 w-5 text-muted-foreground" />;
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function labelForType(type: string) {
  return providerTypes.find((providerType) => providerType.value === type)?.label || type;
}
