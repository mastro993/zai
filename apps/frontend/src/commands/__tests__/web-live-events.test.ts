// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_EVENT_ALERTS, LIVE_EVENT_CURRENCY } from "../web-api";
import { resetSharedLiveEventSourceForTests, subscribeSharedLiveEvents } from "../web-live-events";

class FakeEventSource extends EventTarget {
  static instances: Array<FakeEventSource> = [];

  readonly url: string;
  closed = false;
  readyState = 0;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emit(event: Event) {
    this.dispatchEvent(event);
  }
}

describe("shared live event source", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    resetSharedLiveEventSourceForTests();
    vi.unstubAllGlobals();
  });

  it("reuses one EventSource across named subscriptions", () => {
    const alerts = subscribeSharedLiveEvents(LIVE_EVENT_ALERTS, {
      onEvent: vi.fn(),
      onOpen: vi.fn(),
    });
    const currency = subscribeSharedLiveEvents(LIVE_EVENT_CURRENCY, {
      onEvent: vi.fn(),
      onOpen: vi.fn(),
    });

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.url).toBe("http://127.0.0.1:3000/api/events");
    expect(alerts.source).toBe(currency.source);

    alerts.close();
    expect(FakeEventSource.instances[0]?.closed).toBe(false);

    currency.close();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });

  it("routes named events only to matching subscribers", () => {
    const onAlerts = vi.fn();
    const onCurrency = vi.fn();
    const alerts = subscribeSharedLiveEvents(LIVE_EVENT_ALERTS, {
      onEvent: onAlerts,
      onOpen: vi.fn(),
    });
    const currency = subscribeSharedLiveEvents(LIVE_EVENT_CURRENCY, {
      onEvent: onCurrency,
      onOpen: vi.fn(),
    });
    const source = FakeEventSource.instances[0];

    source?.emit(new MessageEvent("alerts", { data: "alert-payload" }));
    source?.emit(new MessageEvent("currency", { data: "currency-payload" }));

    expect(onAlerts).toHaveBeenCalledWith("alert-payload");
    expect(onCurrency).toHaveBeenCalledWith("currency-payload");

    alerts.close();
    currency.close();
  });
});
