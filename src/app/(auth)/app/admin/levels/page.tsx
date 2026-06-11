"use client";

import { AppPageHeader } from "@/components/layout/app-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Award, Edit, Plus, Trash2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useEffect, useState } from "react";

export type CustomerLevel = {
  id: string;
  name: string;
  minInteractions: number;
  minPageVisits: number;
  minUploads: number;
  minCreditsUsed: number;
  minLogins: number;
  creditReward: number;
};

const DEFAULT_LEVELS: CustomerLevel[] = [
  {
    id: "1",
    name: "Explorer",
    minInteractions: 1,
    minPageVisits: 1,
    minUploads: 0,
    minCreditsUsed: 0,
    minLogins: 1,
    creditReward: 1,
  },
  {
    id: "2",
    name: "Analyst",
    minInteractions: 5,
    minPageVisits: 3,
    minUploads: 1,
    minCreditsUsed: 2,
    minLogins: 3,
    creditReward: 2,
  },
  {
    id: "3",
    name: "Strategist",
    minInteractions: 15,
    minPageVisits: 8,
    minUploads: 3,
    minCreditsUsed: 5,
    minLogins: 7,
    creditReward: 5,
  },
  {
    id: "4",
    name: "Expert",
    minInteractions: 40,
    minPageVisits: 20,
    minUploads: 8,
    minCreditsUsed: 15,
    minLogins: 15,
    creditReward: 10,
  },
  {
    id: "5",
    name: "Champion",
    minInteractions: 100,
    minPageVisits: 50,
    minUploads: 20,
    minCreditsUsed: 40,
    minLogins: 30,
    creditReward: 20,
  },
];

const numericFields = [
  { key: "minInteractions" as const, label: "Interactions", min: 0 },
  { key: "minPageVisits" as const, label: "Visits", min: 0 },
  { key: "minUploads" as const, label: "Uploads", min: 0 },
  { key: "minCreditsUsed" as const, label: "Credits", min: 0 },
  { key: "minLogins" as const, label: "Logins", min: 1 },
  { key: "creditReward" as const, label: "Reward", min: 0 },
];

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<CustomerLevel[]>(DEFAULT_LEVELS);
  const [saved, setSaved] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadLevels = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/admin/levels", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load levels");
        const data = await res.json();
        if (Array.isArray(data?.levels) && data.levels.length > 0) setLevels(data.levels);
        toast({
          title: "Levels loaded",
          description: "Customer levels have been successfully refreshed.",
          variant: "default",
        });
      } catch (err) {
        toast({
          title: "Error loading levels",
          description: err instanceof Error ? err.message : "Failed to load",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadLevels();
  }, [toast]);

  const addLevel = () => {
    setLevels((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Level ${prev.length + 1}`,
        minInteractions: 0,
        minPageVisits: 0,
        minUploads: 0,
        minCreditsUsed: 0,
        minLogins: 1,
        creditReward: 0,
      },
    ]);
    setSaved(null);
  };

  const removeLevel = (id: string) => {
    setLevels((prev) => prev.filter((level) => level.id !== id));
    setSaved(null);
  };

  const save = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved("Levels saved.");
      toast({
        title: "Levels saved",
        description: "Your changes have been successfully saved.",
        variant: "default",
      });
    } catch {
      toast({
        title: "Error saving levels",
        description: "Save failed. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totals = {
    levels: levels.length,
    explorer: levels.filter((l) => l.name === "Explorer").length,
    strategist: levels.filter((l) => l.name === "Strategist").length,
    champion: levels.filter((l) => l.name === "Champion").length,
  };

  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title="Customer Levels"
        description="Define customer tiers and the activity thresholds that unlock each level."
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Customer Levels" }]}
        icon={Award}
      />

      <main className="px-5 py-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total levels",
              value: totals.levels,
              icon: Trash2,
              color: "text-slate-700 dark:text-slate-300",
              bg: "bg-slate-500/10",
            },
            {
              label: "Explorer",
              value: totals.explorer,
              icon: Zap,
              color: "text-emerald-800 dark:text-emerald-100",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Strategist",
              value: totals.strategist,
              icon: Zap,
              color: "text-emerald-800 dark:text-emerald-100",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Champion",
              value: totals.champion,
              icon: Zap,
              color: "text-emerald-800 dark:text-emerald-100",
              bg: "bg-emerald-500/10",
            },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 border-border bg-card">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {saved && (
            <p className="rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
              {saved}
            </p>
          )}
          <DataTable
            title="Customer levels"
            description="Interaction, visit, upload, credit, login, and reward thresholds."
            rows={levels as unknown as Record<string, unknown>[]}
            columns={levelColumns(removeLevel)}
            rowKey={(row) => String(row.id)}
            minWidth="min-w-[980px]"
            selectable
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addLevel} className="gap-1.5 bg-transparent">
                  <Plus className="h-4 w-4" />
                  Add level
                </Button>
                <Button size="sm" onClick={save} disabled={isLoading}>
                  {isLoading ? "Saving…" : "Save"}
                </Button>
              </div>
            }
          />
        </div>
      </main>
    </div>
  );
}

function levelColumns(
  removeLevel: (id: string) => void,
): DataTableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "name",
      header: "Level",
      render: (row, index) => (
        <div>
          <p className="font-medium text-foreground">{String(row.name)}</p>
          <p className="text-xs text-muted-foreground">#{index + 1}</p>
        </div>
      ),
    },
    ...numericFields.map((field) => ({
      key: field.key,
      header: field.label,
      align: "right" as const,
      render: (row: Record<string, unknown>) => Number(row[field.key] ?? 0).toLocaleString(),
    })),
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Link
            href={`/app/admin/edit?type=level&id=${encodeURIComponent(String(row.id))}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            aria-label={`Edit ${String(row.name)}`}
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => removeLevel(String(row.id))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
            aria-label={`Remove ${String(row.name)}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]
}
