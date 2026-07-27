import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(ROOT, "apps/frontend");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const JAVASCRIPT_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  if (!raw.trim()) {
    return {};
  }

  const input = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Agent hook input must be a JSON object.");
  }

  return input;
}

function parseMaybeJson(value) {
  if (typeof value !== "string") {
    return value ?? {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return { command: value };
  }
}

function extractPatchPaths(patch) {
  if (typeof patch !== "string") {
    return [];
  }

  const paths = [];
  const headers = /^\*\*\* (?:Add|Update|Delete) File: (.+)\r?$|^\*\*\* Move to: (.+)\r?$/gm;
  for (const match of patch.matchAll(headers)) {
    paths.push(match[1] ?? match[2]);
  }

  return paths;
}

function pathFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  return [input.file_path, input.filePath, input.path, input.target_file, input.targetFile].filter(
    (value) => typeof value === "string",
  );
}

function editedPathCandidates(input) {
  const eventName = String(input.hook_event_name ?? input.hookEventName ?? "").toLowerCase();
  if (eventName === "afterfileedit") {
    return { isEdit: true, paths: pathFields(input) };
  }

  const toolName = String(input.tool_name ?? input.toolName ?? "").toLowerCase();
  const editTools = new Set([
    "apply_patch",
    "create",
    "edit",
    "multiedit",
    "str_replace_editor",
    "write",
  ]);
  if (!editTools.has(toolName)) {
    return { isEdit: false, paths: [] };
  }

  const toolInput = parseMaybeJson(input.tool_input ?? input.toolArgs);
  const paths = pathFields(toolInput);
  for (const value of [toolInput.command, toolInput.patch, toolInput.input]) {
    paths.push(...extractPatchPaths(value));
  }

  return { isEdit: true, paths };
}

function isInsideRoot(candidate) {
  const relative = path.relative(ROOT, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function resolveEditedFiles(input) {
  const candidates = editedPathCandidates(input);
  if (!candidates.isEdit) {
    return [];
  }
  if (candidates.paths.length === 0) {
    throw new Error("Agent edit hook did not provide an edited file path.");
  }

  const cwd = typeof input.cwd === "string" ? input.cwd : ROOT;
  const files = new Set();
  for (const candidate of candidates.paths) {
    const absolutePath = path.resolve(cwd, candidate.trim());
    if (!isInsideRoot(absolutePath)) {
      throw new Error(`Refusing to format path outside repository: ${candidate}`);
    }

    let metadata;
    try {
      metadata = await lstat(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    const canonicalPath = await realpath(absolutePath);
    if (!isInsideRoot(canonicalPath)) {
      throw new Error(`Refusing to follow path outside repository: ${candidate}`);
    }
    const canonicalMetadata = metadata.isSymbolicLink() ? await lstat(canonicalPath) : metadata;
    if (canonicalMetadata.isFile()) {
      files.add(absolutePath);
    }
  }

  return [...files].sort();
}

function run(program, args, cwd = ROOT, input) {
  return new Promise((resolve) => {
    const child = spawn(program, args, {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ args, error, program, status: null, stderr, stdout });
    });
    child.on("close", (status) => {
      resolve({ args, error: null, program, status, stderr, stdout });
    });
    if (input !== undefined) {
      child.stdin.end(input);
    }
  });
}

function commandName(result) {
  return [result.program, ...result.args].join(" ");
}

function commandOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

async function runFixCommand(program, args, cwd) {
  const result = await run(program, args, cwd);
  if (result.status === 0) {
    return;
  }

  const output = commandOutput(result);
  const detail = result.error?.message || output || `exit status ${result.status}`;
  throw new Error(`${commandName(result)} failed:\n${detail}`);
}

async function formatRustFile(file) {
  const source = await readFile(file, "utf8");
  const result = await run("rustfmt", ["--edition", "2024", "--emit", "stdout"], ROOT, source);
  if (result.status !== 0) {
    const output = commandOutput(result);
    const detail = result.error?.message || output || `exit status ${result.status}`;
    throw new Error(`${commandName(result)} failed for ${path.relative(ROOT, file)}:\n${detail}`);
  }
  if (result.stdout !== source) {
    await writeFile(file, result.stdout);
  }
}

function isFrontendLintFile(file) {
  const relative = path.relative(FRONTEND_ROOT, file);
  return relative.startsWith(`src${path.sep}`) && JAVASCRIPT_EXTENSIONS.has(path.extname(relative));
}

async function fixEditedFiles(input) {
  const files = await resolveEditedFiles(input);
  if (files.length === 0) {
    return;
  }

  const lintFiles = files
    .filter(isFrontendLintFile)
    .map((file) => path.relative(FRONTEND_ROOT, file));
  if (lintFiles.length > 0) {
    await runFixCommand(
      PNPM,
      ["exec", "oxlint", "--fix", "--no-error-on-unmatched-pattern", ...lintFiles],
      FRONTEND_ROOT,
    );
  }

  for (const file of files.filter((candidate) => path.extname(candidate) === ".rs")) {
    await formatRustFile(file);
  }

  await runFixCommand(
    PNPM,
    [
      "--filter",
      "frontend",
      "exec",
      "oxfmt",
      "--write",
      "--no-error-on-unmatched-pattern",
      ...files,
    ],
    ROOT,
  );
}

function diagnosticOutput(result) {
  const raw = (
    result.error?.message ||
    commandOutput(result) ||
    `exit status ${result.status}`
  ).replaceAll("\0", "");
  const tail = raw.split("\n").slice(-60).join("\n");
  return tail.length <= 3_500 ? tail : tail.slice(-3_500);
}

function stopFailure(input, reason) {
  const eventName = String(input.hook_event_name ?? input.hookEventName ?? "");
  if (eventName === "stop" || Object.hasOwn(input, "conversation_id")) {
    return { followup_message: reason };
  }

  return { decision: "block", reason };
}

async function checkBeforeStop(input) {
  const checks = [
    [PNPM, ["type-check"]],
    [PNPM, ["lint"]],
    [PNPM, ["format:check"]],
  ];
  const results = await Promise.all(checks.map(([program, args]) => run(program, args, ROOT)));
  const failures = results.filter((result) => result.status !== 0);
  if (failures.length === 0) {
    return {};
  }

  const diagnostics = failures
    .map(
      (failure) =>
        `${commandName(failure)} (exit ${failure.status ?? "error"})\n${diagnosticOutput(failure)}`,
    )
    .join("\n\n");
  const reason = [
    "Agent quality checks failed.",
    "Fix every failure below, then finish again so the Stop hook reruns all checks.",
    diagnostics,
  ].join("\n\n");

  return stopFailure(input, reason);
}

async function main(input) {
  const mode = process.argv[2];
  if (mode === "fix") {
    await fixEditedFiles(input);
    return;
  }
  if (mode === "stop") {
    process.stdout.write(`${JSON.stringify(await checkBeforeStop(input))}\n`);
    return;
  }

  throw new Error(`Unknown quality hook mode: ${mode ?? "(missing)"}`);
}

let hookInput = {};
try {
  hookInput = await readInput();
  await main(hookInput);
} catch (error) {
  if (process.argv[2] === "stop") {
    const reason = `Agent quality hook failed before checks completed:\n\n${error instanceof Error ? error.message : String(error)}`;
    process.stdout.write(`${JSON.stringify(stopFailure(hookInput, reason))}\n`);
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
