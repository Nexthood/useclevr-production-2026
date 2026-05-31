"use client";

import { AppPageHeader } from "@/components/layout/app-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  CreditCard,
  Link2,
  User,
  Users,
  Zap,
  Edit,
  Trash2,
  Plus,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useEffect, useState } from "react";

interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  plan: string;
  planStatus: string;
  signupDate: string | null;
  lastLogin: string | null;
  referralSource: string | null;
  loginCount: number;
  datasets: number;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPlan, setNewCustomerPlan] = useState("free");
  const [sendInvite, setSendInvite] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/admin/customers", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load customers");
        const data = await res.json();
        setCustomers(data.customers || []);
        toast({
          title: "Customers loaded",
          description: "Customer data has been successfully refreshed.",
          variant: "default",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load";
        setError(message);
        toast({
          title: "Error loading customers",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [toast]);

  const handleDeleteClick = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this customer? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/customers?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete customer");
      }

      const result = await res.json();

      // Remove from customers list
      setCustomers((prev) => prev.filter((c) => c.id !== id));

      toast({
        title: "Customer deleted",
        description: result.message || "Customer has been successfully removed.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Error deleting customer",
        description: err instanceof Error ? err.message : "Failed to delete customer",
        variant: "destructive",
      });
    }
  };

  const handleInviteClick = async (customer: CustomerRow) => {
    if (!customer.email) {
      toast({
        title: "Email required",
        description: "Add an email before sending an invite.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customer.email,
          fullName: customer.name,
          subscriptionTier: customer.plan,
          sendInvite: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to queue invite");
      }

      const data = await res.json();
      toast({
        title: "Invite queued",
        description: data.message || "Invitation is ready to send.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Invite failed",
        description: err instanceof Error ? err.message : "Failed to queue invite",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newCustomerEmail.trim(),
          fullName: newCustomerName.trim() || null,
          subscriptionTier: newCustomerPlan,
          sendInvite,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add customer");
      }

      const data = await res.json();

      if (data.success && data.customer) {
        setCustomers((prev) => [data.customer, ...prev]);
      }

      setShowAddDialog(false);
      setNewCustomerEmail("");
      setNewCustomerName("");
      setNewCustomerPlan("free");
      setSendInvite(false);

      toast({
        title: "Customer added",
        description: data.message || "Customer has been successfully added.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Error adding customer",
        description: err instanceof Error ? err.message : "Failed to add customer",
        variant: "destructive",
      });
    }
  };

  const totals = {
    customers: customers.length,
    pro: customers.filter((c) => c.plan === "pro" || c.plan === "business").length,
    free: customers.filter((c) => c.plan === "free").length,
    active30d: customers.filter((c) => {
      if (!c.lastLogin) return false;
      const diff = Date.now() - new Date(c.lastLogin).getTime();
      return diff < 30 * 24 * 60 * 60 * 1000;
    }).length,
  };

  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title="Customers"
        description="Review registered customers, static demo accounts, plans, and account activity."
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Customers" }]}
        icon={Users}
        actions={
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add customer
          </Button>
        }
      />

      <main className="space-y-6 px-5 py-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total customers",
              value: totals.customers,
              icon: Users,
              color: "text-cyan-800 dark:text-cyan-100",
              bg: "bg-cyan-500/10",
            },
            {
              label: "Pro / Business",
              value: totals.pro,
              icon: CreditCard,
              color: "text-purple-800 dark:text-purple-100",
              bg: "bg-purple-500/10",
            },
            {
              label: "Free tier",
              value: totals.free,
              icon: User,
              color: "text-slate-700 dark:text-slate-300",
              bg: "bg-slate-500/10",
            },
            {
              label: "Active (30 d)",
              value: totals.active30d,
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

        {/* Customer table */}
        {isLoading ? (
          <Card className="border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </Card>
        ) : error ? (
          <Card className="border-border bg-card p-8 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </Card>
        ) : (
          <DataTable
            title="Customer list"
            description="Signup date, last login, plan, referral source, and activity."
            emptyMessage="No customers found."
            rows={customers as unknown as Record<string, unknown>[]}
            columns={customerColumns(handleInviteClick, handleDeleteClick)}
            rowKey={(row) => String(row.id)}
            minWidth="min-w-[1100px]"
          />
        )}
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new customer</DialogTitle>
            <DialogDescription>
              Add a customer manually or send them an invitation to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={newCustomerPlan} onValueChange={setNewCustomerPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sendInvite"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="sendInvite" className="text-sm">
                Send invitation email
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomer} disabled={!newCustomerEmail.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Add customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function customerColumns(
  onInvite: (customer: CustomerRow) => void,
  onDelete: (id: string) => void,
): DataTableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{String(row.name || "—")}</p>
          <p className="text-xs text-muted-foreground">{String(row.email || "—")}</p>
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (row) => (
        <div>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.plan === "free" ? "bg-slate-500/10 text-slate-700 dark:text-slate-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}
          >
            {String(row.plan)}
          </span>
          <span className="ml-1.5 text-xs text-muted-foreground">{String(row.planStatus)}</span>
        </div>
      ),
    },
    {
      key: "signupDate",
      header: "Signup",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {row.signupDate ? new Date(String(row.signupDate)).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last login",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {row.lastLogin ? new Date(String(row.lastLogin)).toLocaleDateString() : "Never"}
        </span>
      ),
    },
    {
      key: "referralSource",
      header: "Referral",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Link2 className="h-3 w-3" />
          {String(row.referralSource || "Direct")}
        </span>
      ),
    },
    { key: "loginCount", header: "Logins", align: "right" },
    { key: "datasets", header: "Datasets", align: "right" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => {
        const customer = row as unknown as CustomerRow

        return (
          <div className="flex justify-end gap-2">
            <Link
              href={`/app/admin/edit?type=customer&id=${encodeURIComponent(customer.id)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
              aria-label={`Edit ${customer.name || customer.email || "customer"}`}
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onInvite(customer)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-emerald-500/10 hover:text-emerald-600"
              aria-label={`Send invite to ${customer.name || customer.email || "customer"}`}
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(customer.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
              aria-label={`Delete ${customer.name || customer.email || "customer"}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ]
}
