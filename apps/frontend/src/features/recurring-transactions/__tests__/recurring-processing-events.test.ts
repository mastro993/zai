// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSharedLiveEventSourceForTests } from "@/commands/web-live-events";
import {
  createTauriRecurringProcessingEventTransport,
  createWebRecurringProcessingEventTransport,
  resolveRecurringProcessingEventTransport,
  selectRecurringProcessingEventTransport,
} from "../commands/recurring-processing-events";

class FakeEventSource extends EventTarget {
  static instances: Array<FakeEventSource> = [];

  readonly url: string;
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(event: Event) {
    this.dispatchEvent(event);
  }
}

describe("recurring processing event transports", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    resetSharedLiveEventSourceForTests();
    vi.unstubAllGlobals();
  });

  it("delivers web events, reports reconnects, and closes cleanly", async () => {
    const onEvent = vi.fn();
    const onReconnect = vi.fn();
    const subscription = createWebRecurringProcessingEventTransport().subscribe(
      onEvent,
      onReconnect,
    );
    const source = FakeEventSource.instances[0];

    source?.emit(new Event("open"));
    expect(source?.url).toBe("http://127.0.0.1:3000/api/events");
    await subscription.ready;

    source?.emit(new MessageEvent("recurring", { data: "payload" }));
    source?.emit(new Event("open"));

    expect(onEvent).toHaveBeenCalledWith("payload");
    expect(onReconnect).toHaveBeenCalledOnce();

    subscription.close();
    source?.emit(new MessageEvent("recurring", { data: "ignored" }));
    expect(source?.closed).toBe(true);
    expect(onEvent).toHaveBeenCalledOnce();
  });

  it("reports initial web subscription failure as typed failure", async () => {
    const onEvent = vi.fn();
    const subscription = createWebRecurringProcessingEventTransport().subscribe(
      onEvent,
      vi.fn(),
      vi.fn(),
    );
    const source = FakeEventSource.instances[0];

    source?.emit(new Event("error"));

    const ready = await subscription.ready;
    expect(ready).toMatchObject({
      type: "Failure",
      error: { code: "subscription_failed" },
    });
  });

  it("reports Tauri listen failure as typed failure", async () => {
    const subscription = createTauriRecurringProcessingEventTransport().subscribe(
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    const ready = await subscription.ready;
    expect(ready).toMatchObject({
      type: "Failure",
      error: { code: "subscription_failed" },
    });
  });

  it("routes web event hints to durable reconciliation", async () => {
    const reconcileFromDurableState = vi.fn();
    const webSubscription = createWebRecurringProcessingEventTransport().subscribe(
      reconcileFromDurableState,
      vi.fn(),
    );
    const webSource = FakeEventSource.instances[0];
    webSource?.emit(new Event("open"));
    await webSubscription.ready;
    webSource?.emit(new MessageEvent("recurring", { data: "state hint" }));

    expect(reconcileFromDurableState).toHaveBeenCalledWith("state hint");
  });

  it("reports web connection loss and reconnect", async () => {
    const onFailure = vi.fn();
    const onReconnect = vi.fn();
    const subscription = createWebRecurringProcessingEventTransport().subscribe(
      vi.fn(),
      onReconnect,
      onFailure,
    );
    const source = FakeEventSource.instances[0];

    source?.emit(new Event("open"));
    await subscription.ready;
    source?.emit(new Event("error"));
    source?.emit(new Event("open"));

    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "subscription_failed" }),
    );
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it("selects only the configured build target and safely ignores invalid targets", async () => {
    const tauri = { subscribe: vi.fn() };
    const web = { subscribe: vi.fn() };
    const transports = { tauri, web };

    expect(selectRecurringProcessingEventTransport("web", transports)).toBe(web);
    expect(resolveRecurringProcessingEventTransport("tauri", transports)).toBe(tauri);

    const fallback = resolveRecurringProcessingEventTransport("desktop", transports);
    const subscription = fallback.subscribe(vi.fn(), vi.fn());
    const ready = await subscription.ready;
    subscription.close();
    expect(tauri.subscribe).not.toHaveBeenCalled();
    expect(web.subscribe).not.toHaveBeenCalled();
    expect(ready).toMatchObject({
      type: "Failure",
      error: { code: "invalid_build_target" },
    });
  });
});
