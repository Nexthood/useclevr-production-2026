"use client";

import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Edit, Plus, Tag, Trash2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useEffect, useState } from "react";

export type DiscountRule = {
  id: string;
  type: "free" | "percentage" | "referral" | "stacking";
  name: string;
  code: string;
  percent?: number;
  description: string;
  enabled: boolean;
  planTarget?: "all" | "free" | "pro" | "business";
};

const DEFAULT_RULES: DiscountRule[] = [
  {
    id: "2",
    type: "referral",
    name: "Referral Reward",
    code: "REFERRAL",
    percent: 100,
    description: "Free month for each successful referral.",
    enabled: true,
  },
];

export default function AdminDiscountsPage() {
  const [rules, setRules] = useState<DiscountRule[]>(DEFAULT_RULES);
  const [saved, setSaved] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadRules = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/admin/discounts", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load discount rules");
        const data = await res.json();
        if (Array.isArray(data?.discountRules) && data.discountRules.length > 0)
          setRules(data.discountRules);
        toast({
          title: "Discount rules loaded",
          description: "Discount rules have been successfully refreshed.",
          variant: "default",
        });
      } catch (err) {
        toast({
          title: "Error loading discount rules",
          description: err instanceof Error ? err.message : "Failed to load",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadRules();
  }, [toast]);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type: "percentage",
        name: "New Discount",
        code: "",
        percent: 10,
        description: "",
        enabled: true,
      },
    ]);
    setSaved(null);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    setSaved(null);
  };

  const save = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved("Discount rules saved.");
      toast({
        title: "Discount rules saved",
        description: "Your changes have been successfully saved.",
        variant: "default",
      });
    } catch {
      toast({
        title: "Error saving discount rules",
        description: "Save failed. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totals = {
    rules: rules.length,
    active: rules.filter((r) => r.enabled).length,
    percentage: rules.filter((r) => r.type === "percentage").length,
    referral: rules.filter((r) => r.type === "referral").length,
  };

  const rightSidebar = (
    <aside className="hidden w-80 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <Card className="p-4 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground">Discount overview</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total rules</span>
                <span className="font-medium">{totals.rules}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">{totals.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Percentage</span>
                <span className="font-medium">{totals.percentage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Referral</span>
                <span className="font-medium">{totals.referral}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground">Rule tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Use clear codes for customer-facing discounts.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Disable unused rules before removing them.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Save changes before leaving this page.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Discount Rules"
      description="Manage free, percentage, referral, and stacking discounts across checkout."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Discount Rules" }]}
      icon={Tag}
      rightSidebar={rightSidebar}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5 bg-transparent">
            <Plus className="h-4 w-4" />
            Add rule
          </Button>
          <Button size="sm" onClick={save} disabled={isLoading}>
            {isLoading ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <main className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total rules",
              value: totals.rules,
              icon: Trash2,
              color: "text-slate-700 dark:text-slate-300",
              bg: "bg-slate-500/10",
            },
            {
              label: "Active",
              value: totals.active,
              icon: Zap,
              color: "text-emerald-800 dark:text-emerald-100",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Percentage",
              value: totals.percentage,
              icon: Zap,
              color: "text-emerald-800 dark:text-emerald-100",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Referral",
              value: totals.referral,
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
            title="Discount rules"
            description="Active discount, referral, and stacking rules."
            rows={rules as unknown as Record<string, unknown>[]}
            columns={discountColumns(removeRule)}
            rowKey={(row) => String(row.id)}
            minWidth="min-w-[1040px]"
            selectable
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5 bg-transparent">
                  <Plus className="h-4 w-4" />
                  Add rule
                </Button>
                <Button size="sm" onClick={save} disabled={isLoading}>
                  {isLoading ? "Saving…" : "Save"}
                </Button>
              </div>
            }
          />
        </div>
      </main>
    </DashboardSubpageLayout>
  );
}

function discountColumns(
  removeRule: (id: string) => void,
): DataTableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{String(row.name)}</p>
          <p className="text-xs text-muted-foreground">{String(row.description || "No description")}</p>
        </div>
      ),
    },
    { key: "type", header: "Type" },
    {
      key: "code",
      header: "Code",
      render: (row) => <span className="font-mono text-xs">{String(row.code || "-")}</span>,
    },
    {
      key: "percent",
      header: "Percent",
      align: "right",
      render: (row) => `${Number(row.percent ?? 0).toLocaleString()}%`,
    },
    {
      key: "planTarget",
      header: "Plan Target",
      render: (row) => {
        const target = String(row.planTarget || "all")
        return (
          <span className="text-xs capitalize">
            {target === "all" ? "All plans" : `${target} plan`}
          </span>
        )
      },
    },
    {
      key: "enabled",
      header: "Status",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-slate-700 dark:text-slate-300"}`}
        >
          {row.enabled ? "Active" : "Disabled"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Link
            href={`/app/admin/edit?type=discount&id=${encodeURIComponent(String(row.id))}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            aria-label={`Edit ${String(row.name)}`}
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => removeRule(String(row.id))}
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
