// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWebAlertEventTransport,
  resolveAlertEventTransport,
  selectAlertEventTransport,
} from "../commands/alert-events";

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

describe("alert event transports", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delivers web events, reports reconnects, and closes cleanly", async () => {
    const onEvent = vi.fn();
    const onReconnect = vi.fn();
    const subscription = createWebAlertEventTransport().subscribe(onEvent, onReconnect);
    const source = FakeEventSource.instances[0];

    expect(source?.url).toBe("http://127.0.0.1:3000/api/alerts/events");
    await subscription.ready;

    source?.emit(new MessageEvent("message", { data: "payload" }));
    source?.emit(new Event("open"));
    source?.emit(new Event("open"));

    expect(onEvent).toHaveBeenCalledWith("payload");
    expect(onReconnect).toHaveBeenCalledOnce();

    subscription.close();
    source?.emit(new MessageEvent("message", { data: "ignored" }));
    expect(source?.closed).toBe(true);
    expect(onEvent).toHaveBeenCalledOnce();
  });

  it("selects only the configured build target and safely ignores invalid targets", async () => {
    const tauri = { subscribe: vi.fn() };
    const web = { subscribe: vi.fn() };
    const transports = { tauri, web };

    expect(selectAlertEventTransport("web", transports)).toBe(web);
    expect(resolveAlertEventTransport("tauri", transports)).toBe(tauri);

    const fallback = resolveAlertEventTransport("desktop", transports);
    const subscription = fallback.subscribe(vi.fn(), vi.fn());
    await subscription.ready;
    subscription.close();
    expect(tauri.subscribe).not.toHaveBeenCalled();
    expect(web.subscribe).not.toHaveBeenCalled();
  });
});
