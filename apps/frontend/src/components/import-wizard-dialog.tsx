import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, FileImportIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ImportStepper, type ImportStep } from "@/components/import-stepper";

interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBusy: boolean;
  title: string;
  description: string;
  step: ImportStep;
  onStepSelect: (step: ImportStep) => void;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  canAdvance: boolean;
  isImporting: boolean;
  footerHint: string;
  confirmLabel: string;
  confirmDisabled: boolean;
  renderStep: (step: ImportStep) => ReactNode;
}

function ImportWizardDialog({
  open,
  onOpenChange,
  isBusy,
  title,
  description,
  step,
  onStepSelect,
  onBack,
  onNext,
  onCancel,
  onConfirm,
  canAdvance,
  isImporting,
  footerHint,
  confirmLabel,
  confirmDisabled,
  renderStep,
}: ImportWizardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={isBusy ? undefined : onOpenChange}>
      <DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-3xl md:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={FileImportIcon}
              className="size-4 text-muted-foreground"
              strokeWidth={1.8}
            />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ImportStepper current={step} onStepSelect={onStepSelect} />

        <div className="min-h-0 overflow-y-auto pr-1">
          <div key={step} className="animate-in fade-in-0 duration-150 motion-reduce:animate-none">
            {renderStep(step)}
          </div>
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">{footerHint}</p>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={onBack} disabled={isImporting}>
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
                Back
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onCancel} disabled={isImporting}>
              Cancel
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={onNext} disabled={!canAdvance}>
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={1.8} />
              </Button>
            ) : (
              <Button type="button" onClick={onConfirm} disabled={confirmDisabled || isImporting}>
                {isImporting ? "Importing…" : confirmLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ImportWizardDialog };
