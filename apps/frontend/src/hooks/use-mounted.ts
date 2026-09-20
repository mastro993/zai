import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

const readMounted = () => true;

export function useMounted() {
  return useSyncExternalStore(subscribeNoop, readMounted, () => false);
}
