import { Result } from "@praha/byethrow";
import { useEffect, useRef } from "react";

import {
  createCurrencyStateEventTransport,
  type CurrencyStateEventError,
} from "../commands/currency-state-events";
import { parseCurrencyStateEvent } from "../lib/parse-currency-state-event";

export class CurrencyStateReconciliationError extends Error {
  override readonly name = "CurrencyStateReconciliationError";

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}

type ReconciliationResult = Result.ResultAsync<void, CurrencyStateReconciliationError>;
type ReconciliationOperation = () => ReconciliationResult;

const reconciliationFailure = (cause: unknown): CurrencyStateReconciliationError =>
  new CurrencyStateReconciliationError("Currency durable state reconciliation failed.", cause);

interface CurrencyStateLiveEventHandlers {
  onReconcile: ReconciliationOperation;
  onReady: ReconciliationOperation;
  onReconciliationFailure?: (error: CurrencyStateReconciliationError) => void;
  onSubscriptionFailure?: (error: CurrencyStateEventError) => void;
  onSubscriptionRecovered?: () => void;
}

export function useCurrencyStateLiveEvents({
  onReconcile,
  onReady,
  onReconciliationFailure,
  onSubscriptionFailure,
  onSubscriptionRecovered,
}: CurrencyStateLiveEventHandlers) {
  const onReconcileRef = useRef(onReconcile);
  const onReadyRef = useRef(onReady);
  const onReconciliationFailureRef = useRef(onReconciliationFailure);
  const onSubscriptionFailureRef = useRef(onSubscriptionFailure);
  const onSubscriptionRecoveredRef = useRef(onSubscriptionRecovered);
  const enqueueReconciliationRef = useRef<(operation: ReconciliationOperation) => void>(
    () => undefined,
  );

  useEffect(() => {
    onReconcileRef.current = onReconcile;
    onReadyRef.current = onReady;
    onReconciliationFailureRef.current = onReconciliationFailure;
    onSubscriptionFailureRef.current = onSubscriptionFailure;
    onSubscriptionRecoveredRef.current = onSubscriptionRecovered;
  }, [
    onReconcile,
    onReady,
    onReconciliationFailure,
    onSubscriptionFailure,
    onSubscriptionRecovered,
  ]);

  useEffect(() => {
    let active = true;
    let pendingOperation: ReconciliationOperation | undefined;
    let reconciliationRunning = false;

    const invokeReconciliation = async (
      operation: ReconciliationOperation,
    ): Result.ResultAsync<void, CurrencyStateReconciliationError> => {
      const invocation = await Result.try({
        try: operation,
        catch: reconciliationFailure,
      });
      if (Result.isFailure(invocation)) {
        return invocation;
      }
      return invocation.value;
    };

    const runPendingReconciliation = async (): Promise<void> => {
      if (!active || !pendingOperation) {
        reconciliationRunning = false;
        return;
      }
      const operation = pendingOperation;
      pendingOperation = undefined;
      const result = await invokeReconciliation(operation);
      if (active && Result.isFailure(result)) {
        onReconciliationFailureRef.current?.(result.error);
      }
      if (active && pendingOperation) {
        return runPendingReconciliation();
      }
      reconciliationRunning = false;
    };

    const enqueueReconciliation = (operation: ReconciliationOperation) => {
      if (!active) {
        return;
      }
      pendingOperation = operation;
      if (reconciliationRunning) {
        return;
      }
      reconciliationRunning = true;
      const loopResult = Result.try({
        try: runPendingReconciliation,
        catch: reconciliationFailure,
      });
      void loopResult.then((result) => {
        if (active && Result.isFailure(result)) {
          reconciliationRunning = false;
          onReconciliationFailureRef.current?.(result.error);
        }
      });
    };
    enqueueReconciliationRef.current = enqueueReconciliation;

    const subscription = createCurrencyStateEventTransport().subscribe(
      (value) => {
        parseCurrencyStateEvent(value);
        enqueueReconciliation(onReconcileRef.current);
      },
      () => {
        onSubscriptionRecoveredRef.current?.();
        enqueueReconciliation(onReconcileRef.current);
      },
      (error) => {
        onSubscriptionFailureRef.current?.(error);
        enqueueReconciliation(onReconcileRef.current);
      },
    );
    enqueueReconciliation(onReconcileRef.current);
    void subscription.ready.then((result) => {
      if (!active) {
        return;
      }
      if (Result.isFailure(result)) {
        onSubscriptionFailureRef.current?.(result.error);
        enqueueReconciliation(onReconcileRef.current);
        return;
      }
      onSubscriptionRecoveredRef.current?.();
      enqueueReconciliation(onReadyRef.current);
    });

    return () => {
      active = false;
      pendingOperation = undefined;
      enqueueReconciliationRef.current = () => undefined;
      subscription.close();
    };
  }, []);

  useEffect(() => {
    const reconcileOnFocus = () => enqueueReconciliationRef.current(onReconcileRef.current);
    const reconcileOnVisibility = () => {
      if (document.visibilityState === "visible") {
        enqueueReconciliationRef.current(onReconcileRef.current);
      }
    };
    window.addEventListener("focus", reconcileOnFocus);
    document.addEventListener("visibilitychange", reconcileOnVisibility);
    return () => {
      window.removeEventListener("focus", reconcileOnFocus);
      document.removeEventListener("visibilitychange", reconcileOnVisibility);
    };
  }, []);
}
