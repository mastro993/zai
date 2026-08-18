import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { ScreenBase } from "@/components/screen-base";

import { SceneRail } from "../components/scene-rail";
import { PrototypeStateDump } from "../components/prototype-state-dump";
import { VariantA } from "../components/variant-a-ledger";
import { VariantB } from "../components/variant-b-inspector";
import { VariantC } from "../components/variant-c-workspace";
import { useCurrencyPrototypeState } from "../hooks/use-currency-prototype-state";
import {
  parsePrototypeVariant,
  PROTOTYPE_VARIANTS,
  VARIANT_NAMES,
  type CurrencyPrototypeSearch,
  type PrototypeScene,
} from "../lib/prototype-search";

const VARIANT_ITEMS = PROTOTYPE_VARIANTS.map((key) => ({
  key,
  name: VARIANT_NAMES[key],
}));

export function CurrencyControlsPrototypeScreen({ search }: { search: CurrencyPrototypeSearch }) {
  const navigate = useNavigate({ from: "/settings" });
  const { state, actions } = useCurrencyPrototypeState();

  const setSearch = useCallback(
    (next: Partial<CurrencyPrototypeSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => ({
          variant: next.variant ?? previous.variant ?? "A",
          scene: next.scene ?? previous.scene ?? "settings",
        }),
      });
    },
    [navigate],
  );

  const onVariantChange = useCallback(
    (key: string) => {
      const variant = parsePrototypeVariant(key);
      if (variant) {
        setSearch({ variant });
      }
    },
    [setSearch],
  );

  const onSceneChange = useCallback(
    (scene: PrototypeScene) => {
      setSearch({ scene });
    },
    [setSearch],
  );

  const variantProps = { scene: search.scene, state, actions };

  return (
    <ScreenBase>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-20">
        <header className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Prototype
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Currency settings and transaction currency controls
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Three variants of initial currency setup, Currency settings, transaction currency
            selection, converted-value presentation, manual-rate editing, pending-rate recovery,
            import warnings, and transaction disclosures. Switch variants with the bar or arrow
            keys. Switch scenes with the rail.
          </p>
        </header>
        <SceneRail scene={search.scene} onChange={onSceneChange} />
        {search.variant === "A" ? <VariantA {...variantProps} /> : null}
        {search.variant === "B" ? <VariantB {...variantProps} /> : null}
        {search.variant === "C" ? <VariantC {...variantProps} /> : null}
        <PrototypeStateDump state={state} onReset={actions.reset} />
      </div>
      {import.meta.env.PROD ? null : (
        <PrototypeSwitcher
          variants={VARIANT_ITEMS}
          current={search.variant}
          onChange={onVariantChange}
        />
      )}
    </ScreenBase>
  );
}
