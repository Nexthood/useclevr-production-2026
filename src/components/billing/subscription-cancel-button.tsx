"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type SubscriptionCancelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  currentPeriodEnd: Date | null;
  onCancel: () => Promise<void>;
  onResume?: () => Promise<void>;
  isCanceled: boolean;
};

export function SubscriptionCancelDialog({
  open,
  onOpenChange,
  planName,
  currentPeriodEnd,
  onCancel,
  onResume,
  isCanceled,
}: SubscriptionCancelDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await onCancel();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to cancel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!onResume) return;
    setIsLoading(true);
    try {
      await onResume();
      router.refresh();
    } catch (error) {
      console.error("Failed to resume:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isCanceled && currentPeriodEnd) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancellation Scheduled</DialogTitle>
            <DialogDescription>
              Your {planName} subscription is scheduled for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4 dark:bg-amber-950 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Your {planName} subscription remains active until{" "}
                <strong>{formatDate(currentPeriodEnd)}</strong>.
                You will not be charged again after this date.
              </p>
            </div>
            {onResume && (
              <p className="text-sm text-muted-foreground">
                You can resume your subscription anytime before the period ends.
              </p>
            )}
          </div>
          <DialogFooter>
            {onResume && (
              <Button
                variant="outline"
                onClick={handleResume}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resume Subscription
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel your {planName} subscription?</DialogTitle>
          <DialogDescription>
            Your subscription will remain active until the end of your current billing period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {currentPeriodEnd ? (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm">
                Your <strong>{planName}</strong> plan will remain active until{" "}
                <strong>{formatDate(currentPeriodEnd)}</strong>.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                You will not be charged again after this date. Your account will
                automatically switch to the Free plan.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your subscription will be cancelled at the end of the current billing period.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Keep {planName}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel at period end
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SubscriptionCancelButtonProps = {
  planName: string;
  currentPeriodEnd: Date | null;
  isCanceled: boolean;
  stripeSubscriptionId: string | null;
};

export function SubscriptionCancelButton({
  planName,
  currentPeriodEnd,
  isCanceled,
  stripeSubscriptionId,
}: SubscriptionCancelButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    if (!stripeSubscriptionId) return;
    
    setLoading(true);
    const response = await fetch("/api/billing/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to cancel");
    }

    router.refresh();
  };

  const handleResume = async () => {
    if (!stripeSubscriptionId) return;

    setLoading(true);
    const response = await fetch("/api/billing/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to resume");
    }

    router.refresh();
  };

  if (!stripeSubscriptionId) {
    return null;
  }

  return (
    <>
      <Button
        variant={isCanceled ? "outline" : "ghost"}
        className={isCanceled ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground"}
        onClick={() => setOpen(true)}
      >
        {isCanceled ? "Cancellation Scheduled" : "Cancel Subscription"}
      </Button>
      <SubscriptionCancelDialog
        open={open}
        onOpenChange={setOpen}
        planName={planName}
        currentPeriodEnd={currentPeriodEnd}
        onCancel={handleCancel}
        onResume={isCanceled ? handleResume : undefined}
        isCanceled={isCanceled}
      />
    </>
  );
}
