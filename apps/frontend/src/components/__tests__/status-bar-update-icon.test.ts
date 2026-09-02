import { describe, expect, it } from "vitest";

import {
  isStatusBarVersionInteractive,
  reduceStatusBarUpdateIconPhase,
  type StatusBarUpdateIconPhase,
} from "../status-bar-update-icon";
import type { UpdateCheckStatus } from "@/features/settings/lib/updater";

const reduce = reduceStatusBarUpdateIconPhase;

const completedStatusCases: Array<{
  status: UpdateCheckStatus;
  phase: StatusBarUpdateIconPhase;
}> = [
  { status: "busy", phase: "idle" },
  { status: "current", phase: "current" },
  { status: "declined", phase: "idle" },
  { status: "restarting", phase: "idle" },
];

describe("isStatusBarVersionInteractive", () => {
  it("keeps production unsigned/web as a span", () => {
    expect(isStatusBarVersionInteractive(false, null)).toBe(false);
  });

  it("lets DEV fake a check when the updater is unavailable", () => {
    expect(isStatusBarVersionInteractive(true, null)).toBe(true);
  });

  it("keeps the real check when an updater target is present", () => {
    expect(isStatusBarVersionInteractive(false, "macos-aarch64")).toBe(true);
  });
});

describe("reduceStatusBarUpdateIconPhase", () => {
  it.each(completedStatusCases)(
    "maps checking + check-completed($status) to $phase",
    ({ status, phase }) => {
      expect(
        reduce("checking", {
          type: "check-completed",
          status,
        }),
      ).toBe(phase);
    },
  );

  it("returns idle after check-failed while checking", () => {
    expect(reduce("checking", { type: "check-failed" })).toBe("idle");
  });

  it("keeps checking when current-feedback-expired arrives during a check", () => {
    expect(reduce("checking", { type: "current-feedback-expired" })).toBe("checking");
  });

  it("starts a new check from the current check mark", () => {
    expect(reduce("current", { type: "check-started" })).toBe("checking");
  });

  it("ignores current-feedback-expired while idle", () => {
    expect(reduce("idle", { type: "current-feedback-expired" })).toBe("idle");
  });
});
