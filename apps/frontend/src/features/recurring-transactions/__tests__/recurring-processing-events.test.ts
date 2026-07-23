import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listenMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

import {
  createTauriRecurringProcessingEventTransport,
  createWebRecurringProcessingEventTransport,
  resolveRecurringProcessingEventTransport,
  selectRecurringProcessingEventTransport,
} from "../commands/recurring-processing-events";

type EventListener = (event: Event) => void;

class FakeEventSource {
  static instances: Array<FakeEventSource> = [];

  readonly url: string;
  closed = false;
  private readonly listeners = new Map<string, EventListener>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as EventListener);
  }

  removeEventListener(type: string) {
    this.listeners.delete(type);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, event: Event) {
    this.listeners.get(type)?.(event);
  }
}

describe("recurring processing event transports", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    listenMock.mockReset();
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
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

    source?.emit("open", new Event("open"));
    expect(source?.url).toBe("http://127.0.0.1:3000/api/cash-flow/recurring-processing/events");
    await subscription.ready;

    source?.emit("message", { data: "payload" } as MessageEvent<string>);
    source?.emit("open", new Event("open"));

    expect(onEvent).toHaveBeenCalledWith("payload");
    expect(onReconnect).toHaveBeenCalledOnce();

    subscription.close();
    source?.emit("message", { data: "ignored" } as MessageEvent<string>);
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

    source?.emit("error", new Event("error"));

    const ready = await subscription.ready;
    expect(ready).toMatchObject({
      type: "Failure",
      error: { code: "subscription_failed" },
    });
  });

  it("reports Tauri listen failure as typed failure", async () => {
    listenMock.mockRejectedValueOnce(new Error("listen unavailable"));

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

  it("delivers Tauri events and disposes listener", async () => {
    const onEvent = vi.fn();
    const dispose = vi.fn();
    let listener: ((event: { payload: string }) => void) | undefined;
    listenMock.mockImplementationOnce(
      async (_name: string, callback: (event: { payload: string }) => void) => {
        listener = callback;
        return dispose;
      },
    );

    const subscription = createTauriRecurringProcessingEventTransport().subscribe(onEvent, vi.fn());
    const ready = await subscription.ready;

    expect(ready).toMatchObject({ type: "Success" });
    listener?.({ payload: "payload" });
    expect(onEvent).toHaveBeenCalledWith("payload");

    subscription.close();
    listener?.({ payload: "ignored" });
    expect(dispose).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledOnce();
  });

  it("routes web and Tauri event hints to the same durable reconciliation callback", async () => {
    const reconcileFromDurableState = vi.fn();
    const webSubscription = createWebRecurringProcessingEventTransport().subscribe(
      reconcileFromDurableState,
      vi.fn(),
    );
    const webSource = FakeEventSource.instances[0];
    webSource?.emit("open", new Event("open"));
    await webSubscription.ready;
    webSource?.emit("message", { data: "state hint" } as MessageEvent<string>);

    let tauriListener: ((event: { payload: string }) => void) | undefined;
    listenMock.mockImplementationOnce(
      async (_name: string, callback: (event: { payload: string }) => void) => {
        tauriListener = callback;
        return vi.fn();
      },
    );
    const tauriSubscription = createTauriRecurringProcessingEventTransport().subscribe(
      reconcileFromDurableState,
      vi.fn(),
    );
    await tauriSubscription.ready;
    tauriListener?.({ payload: "state hint" });

    expect(reconcileFromDurableState).toHaveBeenCalledTimes(2);
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

    source?.emit("open", new Event("open"));
    await subscription.ready;
    source?.emit("error", new Event("error"));
    source?.emit("open", new Event("open"));

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
