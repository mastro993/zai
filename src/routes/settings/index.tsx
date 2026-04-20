import { Tab, Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-col px-4 py-3">
      <div className="flex w-full flex-col">
        <Tabs aria-label="Options">
          <Tab key="photos" title="Photos">
            ...
          </Tab>
          <Tab key="music" title="Music">
            ...
          </Tab>
          <Tab key="videos" title="Videos">
            ...
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
