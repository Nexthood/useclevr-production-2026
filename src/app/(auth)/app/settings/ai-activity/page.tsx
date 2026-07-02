import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAiRequestAuditLogs } from "@/lib/ai/ai-request-audit";
import { auth } from "@/lib/auth/auth";
import { getHybridAiFeatureAccess, logBlockedHybridAiFeatureAttempt } from "@/lib/hybrid-ai/feature-gate";
import type { AiRequestAuditEntry } from "@/lib/ai/ai-request-audit";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";

export const metadata = { title: "AI Activity — Useclever" };

export default async function AiActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await getHybridAiFeatureAccess(session.user.id, session.user.role);
  const isSuperAdmin = session.user.role === "superadmin";
  const canViewOwnActivity = access.canUseLite;
  const canViewEnterpriseAudit = access.enabledFeatureIds.includes("enterpriseAudit");
  if (!canViewOwnActivity) {
    logBlockedHybridAiFeatureAttempt({
      userId: session.user.id,
      role: access.role,
      subscriptionTier: access.subscriptionTier,
      featureId: "enterpriseAudit",
      requiredTier: "lite",
      source: "settings-ai-activity",
      message: "AI Activity requires Hybrid AI Lite or MEGA.",
    });
  }

  const entries = canViewOwnActivity
    ? await listAiRequestAuditLogs({
        userId: session.user.id,
        role: canViewEnterpriseAudit ? session.user.role : "user",
        limit: 100,
      })
    : [];
  const showEnterpriseAudit = isSuperAdmin && canViewEnterpriseAudit;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Activity</h1>
        <p className="text-sm text-muted-foreground">
          Review which AI provider handled each request, where it ran, and whether fallback routing was used.
        </p>
      </div>

      {!canViewOwnActivity ? (
        <Card>
          <CardHeader>
            <CardTitle>Hybrid AI Lite required</CardTitle>
            <CardDescription>
              AI Activity is available with Hybrid AI Lite and MEGA because it reviews provider routing for Hybrid AI requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/app/settings/checkout?plan=pro_monthly"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Upgrade to Pro
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {canViewOwnActivity ? (
        <Card>
          <CardHeader>
            <CardTitle>{showEnterpriseAudit ? "Provider usage across workspaces" : "Your AI provider usage"}</CardTitle>
            <CardDescription>
              This log stores routing metadata only. Prompts, responses, API keys, and dataset content are not stored here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No AI provider activity has been recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Time</th>
                      {showEnterpriseAudit && <th className="px-3 py-2 font-medium">User</th>}
                      <th className="px-3 py-2 font-medium">Purpose</th>
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 font-medium">Location</th>
                      <th className="px-3 py-2 font-medium">Fallback</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.map((entry) => (
                      <AiActivityRow key={entry.id} entry={entry} showUser={showEnterpriseAudit} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AiActivityRow({ entry, showUser }: { entry: AiRequestAuditEntry; showUser: boolean }) {
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
      {showUser && <td className="max-w-[180px] truncate px-3 py-3 text-muted-foreground">{entry.userId}</td>}
      <td className="px-3 py-3">
        <div className="font-medium text-foreground">{formatPurpose(entry.purpose)}</div>
        {entry.datasetId && <div className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">Dataset {entry.datasetId}</div>}
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-foreground">{entry.providerName}</div>
        <div className="mt-1 text-xs text-muted-foreground">{entry.providerType}</div>
      </td>
      <td className="max-w-[160px] truncate px-3 py-3 text-muted-foreground">{entry.modelName}</td>
      <td className="px-3 py-3">
        <StatusBadge tone="neutral">{formatMode(entry.mode)}</StatusBadge>
      </td>
      <td className="px-3 py-3">
        <StatusBadge tone={entry.executionLocation === "local" ? "success" : entry.executionLocation === "cloud" ? "warning" : "danger"}>
          {formatLocation(entry.executionLocation)}
        </StatusBadge>
      </td>
      <td className="px-3 py-3">
        <StatusBadge tone={entry.fallbackUsed ? "warning" : "neutral"}>{entry.fallbackUsed ? "Yes" : "No"}</StatusBadge>
      </td>
      <td className="px-3 py-3">
        <StatusBadge tone={entry.success ? "success" : "danger"}>{entry.success ? "Success" : "Failed"}</StatusBadge>
        {entry.errorReason && <p className="mt-2 max-w-[220px] text-xs text-muted-foreground">{entry.errorReason}</p>}
      </td>
    </tr>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "danger" | "neutral" }) {
  const className = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    neutral: "border-border bg-muted text-muted-foreground",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPurpose(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMode(value: string) {
  if (value === "local-only") return "Local only";
  if (value === "cloud-only") return "Cloud only";
  return "Auto";
}

function formatLocation(value: string) {
  if (value === "local") return "Local";
  if (value === "cloud") return "Cloud";
  return "None";
}
