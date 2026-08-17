import type { CurrencyPrototypeActions } from "./hooks/use-currency-prototype-state";
import type { PrototypeState } from "./lib/mock-state";
import type { PrototypeScene } from "./lib/prototype-search";

export interface CurrencyPrototypeVariantProps {
  scene: PrototypeScene;
  state: PrototypeState;
  actions: CurrencyPrototypeActions;
}
