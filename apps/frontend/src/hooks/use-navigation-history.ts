import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import {
  nextForwardBound,
  readHistoryIndex,
  resolveNavigationHistoryAbility,
  type NavigationHistoryAbility,
} from "@/lib/navigation-history";

export const useNavigationHistory = (): NavigationHistoryAbility & {
  goBack: () => void;
  goForward: () => void;
} => {
  const router = useRouter();
  const forwardBoundRef = useRef(readHistoryIndex(router.history.location.state));
  const [ability, setAbility] = useState<NavigationHistoryAbility>(() =>
    resolveNavigationHistoryAbility(
      readHistoryIndex(router.history.location.state),
      forwardBoundRef.current,
    ),
  );

  useEffect(() => {
    const sync = (index: number, truncatesForward: boolean) => {
      forwardBoundRef.current = nextForwardBound(forwardBoundRef.current, index, truncatesForward);
      setAbility(resolveNavigationHistoryAbility(index, forwardBoundRef.current));
    };

    sync(readHistoryIndex(router.history.location.state), false);

    return router.history.subscribe(({ location, action }) => {
      sync(readHistoryIndex(location.state), action.type === "PUSH");
    });
  }, [router]);

  const goBack = useCallback(() => {
    router.history.back();
  }, [router]);

  const goForward = useCallback(() => {
    router.history.forward();
  }, [router]);

  return {
    ...ability,
    goBack,
    goForward,
  };
};
