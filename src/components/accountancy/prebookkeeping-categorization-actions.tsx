"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function StartCategorizationButton({ datasetId }: { datasetId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function startCategorization() {
    setPending(true);
    try {
      const response = await fetch("/api/prebookkeeping/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Categorization failed.");
      }
      toast({
        title: "Categorization complete",
        description: "Transactions are ready for review.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Categorization failed",
        description: error instanceof Error ? error.message : "Try again or review the dataset rows.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" onClick={startCategorization} disabled={pending} className="gap-2">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tags className="h-4 w-4" />}
      {pending ? "Categorizing" : "Start categorization"}
    </Button>
  );
}
