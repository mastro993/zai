import { PrototypeSwitcher } from "@/components/prototype-switcher";

import { VARIANT_A_META, VariantA } from "./variant-a";
import { VARIANT_B_META, VariantB } from "./variant-b";
import { VARIANT_C_META, VariantC } from "./variant-c";

// Three variants of global recurring budget forecast presentation, switchable via ?variant=, on /cash-flow/forecast.
const VARIANTS = [VARIANT_A_META, VARIANT_B_META, VARIANT_C_META] as const;

export type ForecastPrototypeVariant = (typeof VARIANTS)[number]["key"];

interface ForecastPrototypeScreenProps {
  variant: ForecastPrototypeVariant;
}

export function ForecastPrototypeScreen({ variant }: ForecastPrototypeScreenProps) {
  return (
    <>
      {variant === "A" ? <VariantA /> : null}
      {variant === "B" ? <VariantB /> : null}
      {variant === "C" ? <VariantC /> : null}
      <PrototypeSwitcher variants={[...VARIANTS]} current={variant} to="/cash-flow/forecast" />
    </>
  );
}
