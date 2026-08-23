import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { useNavigationHistory } from "@/hooks/use-navigation-history";

export function NavigationHistoryButtons() {
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();

  return (
    <div data-slot="navigation-history-buttons" className="flex shrink-0 items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!canGoBack}
        aria-label="Go back"
        className="text-muted-foreground hover:text-foreground"
        onClick={goBack}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!canGoForward}
        aria-label="Go forward"
        className="text-muted-foreground hover:text-foreground"
        onClick={goForward}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
      </Button>
    </div>
  );
}
