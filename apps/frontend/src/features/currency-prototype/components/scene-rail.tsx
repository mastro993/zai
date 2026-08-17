import { Button } from "@/components/ui/button";

import { PROTOTYPE_SCENES, SCENE_LABELS, type PrototypeScene } from "../lib/prototype-search";

export function SceneRail({
  scene,
  onChange,
}: {
  scene: PrototypeScene;
  onChange: (scene: PrototypeScene) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 border border-border bg-muted/40 p-1"
      role="tablist"
      aria-label="Prototype scenes"
    >
      {PROTOTYPE_SCENES.map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant={item === scene ? "secondary" : "ghost"}
          role="tab"
          aria-selected={item === scene}
          onClick={() => onChange(item)}
        >
          {SCENE_LABELS[item]}
        </Button>
      ))}
    </div>
  );
}
