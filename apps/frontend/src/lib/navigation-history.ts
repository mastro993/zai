export interface NavigationHistoryAbility {
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface HistoryLocationState {
  __TSR_index?: number;
}

export const readHistoryIndex = (state: HistoryLocationState): number => state["__TSR_index"] ?? 0;

export const nextForwardBound = (
  forwardBound: number,
  index: number,
  truncatesForward: boolean,
): number => (truncatesForward ? index : Math.max(forwardBound, index));

export const resolveNavigationHistoryAbility = (
  index: number,
  forwardBound: number,
): NavigationHistoryAbility => ({
  canGoBack: index !== 0,
  canGoForward: index < forwardBound,
});
