import { Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ColorPalettePreview } from "../../features/transaction-category/components/ColorPalettePreview";

export const Route = createFileRoute("/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Tabs className="w-full max-w-md">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Tabs with disabled">
          <Tabs.Tab id="colors">
            Colors
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="pt-4" id="colors">
        <ColorPalettePreview />
      </Tabs.Panel>
    </Tabs>
  );
}
