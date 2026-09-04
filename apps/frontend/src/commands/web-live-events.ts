import { resolveLiveEventsUrl } from "@/commands/web-api";
import { asWireString } from "@/lib/wire";

const EVENT_SOURCE_OPEN = 1;

interface SharedLiveEventSource {
  source: EventSource;
  refs: number;
}

let shared: SharedLiveEventSource | undefined;

const acquireSharedLiveEventSource = (): EventSource => {
  if (shared !== undefined) {
    shared.refs += 1;
    return shared.source;
  }

  const source = new EventSource(resolveLiveEventsUrl());
  shared = { source, refs: 1 };
  return source;
};

const releaseSharedLiveEventSource = (source: EventSource): void => {
  if (shared === undefined || shared.source !== source) {
    source.close();
    return;
  }

  shared.refs -= 1;
  if (shared.refs > 0) {
    return;
  }

  shared.source.close();
  shared = undefined;
};

export const resetSharedLiveEventSourceForTests = (): void => {
  shared?.source.close();
  shared = undefined;
};

export interface SharedLiveEventListeners {
  onEvent: (payload: string) => void;
  onOpen: () => void;
  onError?: () => void;
}

export interface SharedLiveEventHandle {
  source: EventSource;
  close: () => void;
}

export const subscribeSharedLiveEvents = (
  eventName: string,
  listeners: SharedLiveEventListeners,
): SharedLiveEventHandle => {
  const source = acquireSharedLiveEventSource();
  const handleMessage = (event: Event) => {
    if (!(event instanceof MessageEvent)) {
      return;
    }
    const payload = asWireString(event.data);
    if (payload !== undefined) {
      listeners.onEvent(payload);
    }
  };
  const handleOpen = () => {
    listeners.onOpen();
  };
  const handleError = () => {
    listeners.onError?.();
  };

  source.addEventListener(eventName, handleMessage);
  source.addEventListener("open", handleOpen);
  if (listeners.onError !== undefined) {
    source.addEventListener("error", handleError);
  }
  if (source.readyState === EVENT_SOURCE_OPEN) {
    handleOpen();
  }

  return {
    source,
    close: () => {
      source.removeEventListener(eventName, handleMessage);
      source.removeEventListener("open", handleOpen);
      if (listeners.onError !== undefined) {
        source.removeEventListener("error", handleError);
      }
      releaseSharedLiveEventSource(source);
    },
  };
};
