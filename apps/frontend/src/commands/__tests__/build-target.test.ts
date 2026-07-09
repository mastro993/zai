import { describe, expect, it } from "vitest";

import { Result } from "@praha/byethrow";

import {
  parseCommandBuildTarget,
  selectCommandTransport,
  type CommandTransportMap,
} from "../build-target";

const transports = {
  tauri: {
    invoke: async <T>() => "tauri" as T,
  },
  web: {
    invoke: async <T>() => "web" as T,
  },
} satisfies CommandTransportMap;

describe("command build target", () => {
  it("selects the Tauri transport for the tauri build target", () => {
    expect(selectCommandTransport("tauri", transports)).toBe(transports.tauri);
  });

  it("selects the web transport for the web build target", () => {
    expect(selectCommandTransport("web", transports)).toBe(transports.web);
  });

  it("fails when the command build target is missing", () => {
    const result = parseCommandBuildTarget(undefined);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error.message).toBe(
      "VITE_ZAI_BUILD_TARGET is required. Expected one of: tauri, web.",
    );
  });

  it("fails when the command build target is unknown", () => {
    const result = parseCommandBuildTarget("native");

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error.message).toBe(
      'Unknown VITE_ZAI_BUILD_TARGET "native". Expected one of: tauri, web.',
    );
  });
});
