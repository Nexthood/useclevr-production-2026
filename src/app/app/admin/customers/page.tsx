"use client";

import { AppPageHeader } from "@/components/layout/app-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Check,
  X,
  Trash2,
  Plus,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface EditableCustomer extends CustomerRow {
  isEditing?: boolean;
  editName: string;
  editEmail: string;
  editPlan: string;
  editPlanStatus: string;
  editBusinessName: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editableCustomers, setEditableCustomers] = useState<EditableCustomer[]>([]);
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
        // Initialize editable customers
        setEditableCustomers(
          data.customers?.map((c: CustomerRow) => ({
            ...c,
            isEditing: false,
            editName: c.name || "",
            editEmail: c.email || "",
            editPlan: c.plan,
            editPlanStatus: c.planStatus,
            editBusinessName: c.name || "", // Using name as businessName fallback
          })) || [],
        );
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

  const handleEditClick = (id: string) => {
    setEditableCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, isEditing: true } : c)));
  };

  const handleCancelEdit = (id: string) => {
    setEditableCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, isEditing: false } : c)));
  };

  const handleSaveEdit = async (id: string) => {
    const customer = editableCustomers.find((c) => c.id === id);
    if (!customer) return;

    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          updates: {
            fullName: customer.editName,
            email: customer.editEmail,
            subscriptionTier: customer.editPlan,
            stripeStatus: customer.editPlanStatus,
            businessName: customer.editBusinessName,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update customer");
      }

      const updatedCustomer = await res.json();

      // Update the customers list
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                name: updatedCustomer.customer.name,
                email: updatedCustomer.customer.email,
                plan: updatedCustomer.customer.plan,
                planStatus: updatedCustomer.customer.planStatus,
                businessName: updatedCustomer.customer.name, // Using name as businessName fallback
              }
            : c,
        ),
      );

      // Update editable customers
      setEditableCustomers((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                isEditing: false,
                name: updatedCustomer.customer.name,
                email: updatedCustomer.customer.email,
                plan: updatedCustomer.customer.plan,
                planStatus: updatedCustomer.customer.planStatus,
              }
            : c,
        ),
      );

      toast({
        title: "Customer updated",
        description: "Customer information has been successfully saved.",
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Error updating customer",
        description: err instanceof Error ? err.message : "Failed to update customer",
        variant: "destructive",
      });
    }
  };

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

      // Remove from editable customers
      setEditableCustomers((prev) => prev.filter((c) => c.id !== id));

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
        setEditableCustomers((prev) => [
          {
            ...data.customer,
            isEditing: false,
            editName: data.customer.name || "",
            editEmail: data.customer.email || "",
            editPlan: data.customer.plan,
            editPlanStatus: data.customer.planStatus,
            editBusinessName: data.customer.name || "",
          },
          ...prev,
        ]);
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
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Customers"
        description="Review registered customers, static demo accounts, plans, and account activity."
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Customers" }]}
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
        <Card className="border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Customer list</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Signup date, last login, plan, referral source, and activity.
            </p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No customers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Signup</th>
                    <th className="px-5 py-3 font-medium">Last login</th>
                    <th className="px-5 py-3 font-medium">Referral</th>
                    <th className="px-5 py-3 font-medium text-right">Logins</th>
                    <th className="px-5 py-3 font-medium text-right">Datasets</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{c.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.email || "—"}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.plan === "free" ? "bg-slate-500/10 text-slate-700 dark:text-slate-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}
                        >
                          {c.plan}
                        </span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{c.planStatus}</span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {c.signupDate ? new Date(c.signupDate).toLocaleDateString() : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {c.lastLogin ? new Date(c.lastLogin).toLocaleDateString() : "Never"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {c.referralSource || "Direct"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{c.loginCount}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{c.datasets}</td>
                      <td className="px-5 py-3 flex space-x-2">
                        {!editableCustomers.find((ec) => ec.id === c.id)?.isEditing ? (
                          <>
                            <button
                              onClick={() => handleEditClick(c.id)}
                              className="btn-edit inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-blue-500/10 hover:text-blue-600"
                              aria-label={`Edit ${c.name}`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleInviteClick(c)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-emerald-500/10 hover:text-emerald-600"
                              aria-label={`Send invite to ${c.name || c.email || "customer"}`}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(c.id)}
                              className="btn-delete inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                              aria-label={`Delete ${c.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSaveEdit(c.id)}
                              className="btn-save inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                              aria-label={`Save changes for ${c.name}`}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCancelEdit(c.id)}
                              className="btn-cancel inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-gray-500/10 hover:text-gray-600"
                              aria-label={`Cancel editing ${c.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
