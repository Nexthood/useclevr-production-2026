"use client";

import { useId, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function SubmissionConfirmation({
  open,
  title,
  children,
  onDone,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onDone: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        dismissible={false}
        className="dark space-y-5 bg-card text-card-foreground sm:p-8"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CircleCheck aria-hidden="true" className="size-6" />
        </div>
        <DialogTitle id={titleId} className="text-2xl">
          {title}
        </DialogTitle>
        <div id={descriptionId} className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            onClick={onDone}
            className="w-full motion-reduce:transition-none sm:w-auto"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
