import { createFileRoute } from "@tanstack/react-router";
import { LoaderPinwheelIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useState } from "react";

export const Route = createFileRoute("/support/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="h-full w-full p-4">
      {!isLoaded && (
        <div className="flex items-center justify-center h-full">
          <Icon icon={LoaderPinwheelIcon} className="size-4 animate-spin" />
        </div>
      )}
      <iframe
        src="https://getzai.app"
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
