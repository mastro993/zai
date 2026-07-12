import assert from "node:assert/strict";
import test from "node:test";

import { buildHookPlan, runQualityHook } from "./check-hooks.mjs";

const root = process.cwd();

test("builds frontend format and lint fix/check commands for an edited file", () => {
  const plan = buildHookPlan(
    {
      tool_name: "Edit",
      tool_input: { file_path: "apps/frontend/src/example.tsx" },
    },
    root,
  );

  assert.deepEqual(plan.targets, ["apps/frontend/src/example.tsx"]);
  assert.deepEqual(
    plan.fixCommands.map(({ command, args, cwd }) => ({ command, args, cwd })),
    [
      {
        command: "pnpm",
        args: ["exec", "oxfmt", "--write", "src/example.tsx"],
        cwd: `${root}/apps/frontend`,
      },
      {
        command: "pnpm",
        args: ["exec", "oxlint", "--fix", "--deny-warnings", "src/example.tsx"],
        cwd: `${root}/apps/frontend`,
      },
    ],
  );
  assert.deepEqual(
    plan.verifyCommands.map(({ command, args }) => ({ command, args })),
    [
      {
        command: "pnpm",
        args: ["exec", "oxfmt", "--check", "src/example.tsx"],
      },
      {
        command: "pnpm",
        args: ["exec", "oxlint", "--deny-warnings", "src/example.tsx"],
      },
    ],
  );
});

test("builds package-scoped Rust format and Clippy fix/check commands", () => {
  const plan = buildHookPlan(
    {
      tool_name: "Write",
      tool_input: { file_path: "crates/core/src/lib.rs" },
    },
    root,
  );

  assert.deepEqual(plan.targets, ["crates/core/src/lib.rs"]);
  assert.deepEqual(
    plan.fixCommands.map(({ command, args }) => ({ command, args })),
    [
      {
        command: "rustfmt",
        args: ["--edition", "2024", "crates/core/src/lib.rs"],
      },
      {
        command: "cargo",
        args: [
          "clippy",
          "--package",
          "zai-core",
          "--fix",
          "--allow-dirty",
          "--allow-staged",
          "--all-targets",
          "--all-features",
          "--",
          "-D",
          "warnings",
        ],
      },
    ],
  );
  assert.deepEqual(
    plan.verifyCommands.map(({ command, args }) => ({ command, args })),
    [
      {
        command: "rustfmt",
        args: ["--edition", "2024", "--check", "crates/core/src/lib.rs"],
      },
      {
        command: "cargo",
        args: [
          "clippy",
          "--package",
          "zai-core",
          "--all-targets",
          "--all-features",
          "--",
          "-D",
          "warnings",
        ],
      },
    ],
  );
});

test("handles apply_patch paths and skips unrelated files", () => {
  const plan = buildHookPlan(
    {
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: apps/frontend/src/example.tsx",
          "*** Update File: crates/core/src/lib.rs",
          "*** Update File: README.md",
          "*** End Patch",
        ].join("\n"),
      },
    },
    root,
  );

  assert.deepEqual(plan.targets, ["apps/frontend/src/example.tsx", "crates/core/src/lib.rs"]);
  assert.equal(plan.fixCommands.length, 4);
  assert.equal(plan.verifyCommands.length, 4);
});

test("handles GitHub Copilot edit payloads", () => {
  const plan = buildHookPlan(
    {
      toolName: "edit",
      toolArgs: JSON.stringify({ path: "apps/frontend/src/example.tsx" }),
    },
    root,
  );

  assert.deepEqual(plan.targets, ["apps/frontend/src/example.tsx"]);
  assert.equal(plan.fixCommands.length, 2);
});

test("does not run commands when the edit has no supported target", async () => {
  const calls = [];
  const result = await runQualityHook(
    {
      tool_name: "Edit",
      tool_input: { file_path: "README.md" },
    },
    root,
    {
      run: async (command) => {
        calls.push(command);
        return { code: 0, stdout: "", stderr: "" };
      },
    },
  );

  assert.equal(result.status, "skipped");
  assert.deepEqual(calls, []);
});

test("runs all fix commands before verification commands", async () => {
  const calls = [];
  const result = await runQualityHook(
    {
      tool_name: "Edit",
      tool_input: { file_path: "apps/frontend/src/example.tsx" },
    },
    root,
    {
      run: async (command) => {
        calls.push(command);
        return { code: 0, stdout: "", stderr: "" };
      },
    },
  );

  assert.equal(result.status, "passed");
  assert.equal(calls.length, 4);
  assert.deepEqual(calls, [...result.plan.fixCommands, ...result.plan.verifyCommands]);
});
