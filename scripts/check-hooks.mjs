import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const FRONTEND_FORMAT_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".jsx",
  ".less",
  ".sass",
  ".scss",
  ".ts",
  ".tsx",
]);
const FRONTEND_LINT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const RUST_EXTENSIONS = new Set([".rs"]);
const PATCH_PATH_PATTERN = /^\*\*\* (?:Update|Add) File: (.+)$/gm;

function normalizePath(filePath, root) {
  if (typeof filePath !== "string" || !filePath.trim()) return null;
  const absolutePath = path.resolve(root, filePath.trim());
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return relativePath.split(path.sep).join("/");
}

function parsePatchPaths(command) {
  if (typeof command !== "string") return [];
  return Array.from(command.matchAll(PATCH_PATH_PATTERN), ([, filePath]) => filePath.trim());
}

function parseToolArgs(toolArgs) {
  if (toolArgs && typeof toolArgs === "object" && !Array.isArray(toolArgs)) return toolArgs;
  if (typeof toolArgs !== "string" || !toolArgs.trim()) return {};
  try {
    const parsed = JSON.parse(toolArgs);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function collectTargetFiles(event, root) {
  const targets = [];
  const add = (filePath) => {
    const normalizedPath = normalizePath(filePath, root);
    if (normalizedPath && !targets.includes(normalizedPath)) targets.push(normalizedPath);
  };
  const toolInput =
    event?.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};

  if (event?.tool_name === "apply_patch") {
    for (const filePath of parsePatchPaths(toolInput.command)) add(filePath);
  }
  add(toolInput.file_path);
  add(toolInput.path);
  add(event?.file_path);

  const githubArgs = parseToolArgs(event?.toolArgs);
  if (typeof event?.toolArgs === "string" && event.toolArgs.includes("*** ")) {
    for (const filePath of parsePatchPaths(event.toolArgs)) add(filePath);
  } else {
    add(githubArgs.path || githubArgs.file_path || githubArgs.filePath || githubArgs.target_file);
  }

  return targets;
}

function command(command, args, cwd, label) {
  return { command, args, cwd, label };
}

function findCargoPackageName(filePath, root) {
  let directory = path.dirname(path.resolve(root, filePath));
  const rootPath = path.resolve(root);
  while (directory.startsWith(rootPath) && directory !== path.dirname(directory)) {
    const manifestPath = path.join(directory, "Cargo.toml");
    if (fs.existsSync(manifestPath)) {
      const manifest = fs.readFileSync(manifestPath, "utf8");
      const packageSection = manifest.match(/\[package\]([\s\S]*?)(?:\n\[|$)/);
      const packageName = packageSection?.[1]?.match(/^name\s*=\s*["']([^"']+)["']/m)?.[1];
      return packageName || null;
    }
    directory = path.dirname(directory);
  }
  return null;
}

function relativeFrontendPath(filePath) {
  return filePath.slice("apps/frontend/".length);
}

export function buildHookPlan(event, root) {
  const targets = collectTargetFiles(event, root);
  const frontendFiles = targets.filter((filePath) => filePath.startsWith("apps/frontend/"));
  const backendFiles = targets.filter(
    (filePath) =>
      (filePath.startsWith("apps/") || filePath.startsWith("crates/")) &&
      RUST_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
  );
  const frontendFormatFiles = frontendFiles.filter((filePath) =>
    FRONTEND_FORMAT_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
  );
  const frontendLintFiles = frontendFiles.filter((filePath) =>
    FRONTEND_LINT_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
  );
  const supportedTargets = [
    ...new Set([
      ...frontendFormatFiles,
      ...backendFiles.filter((filePath) => findCargoPackageName(filePath, root)),
    ]),
  ];
  const rootPath = path.resolve(root);
  const frontendRoot = path.join(rootPath, "apps", "frontend");
  const fixCommands = [];
  const verifyCommands = [];

  if (frontendFormatFiles.length > 0) {
    const files = frontendFormatFiles.map(relativeFrontendPath);
    fixCommands.push(
      command("pnpm", ["exec", "oxfmt", "--write", ...files], frontendRoot, "frontend format"),
    );
    verifyCommands.push(
      command(
        "pnpm",
        ["exec", "oxfmt", "--check", ...files],
        frontendRoot,
        "frontend format check",
      ),
    );
  }
  if (frontendLintFiles.length > 0) {
    const files = frontendLintFiles.map(relativeFrontendPath);
    fixCommands.push(
      command(
        "pnpm",
        ["exec", "oxlint", "--fix", "--deny-warnings", ...files],
        frontendRoot,
        "frontend lint",
      ),
    );
    verifyCommands.push(
      command(
        "pnpm",
        ["exec", "oxlint", "--deny-warnings", ...files],
        frontendRoot,
        "frontend lint check",
      ),
    );
  }
  if (backendFiles.length > 0) {
    fixCommands.push(
      command("rustfmt", ["--edition", "2024", ...backendFiles], rootPath, "backend format"),
    );
    verifyCommands.push(
      command(
        "rustfmt",
        ["--edition", "2024", "--check", ...backendFiles],
        rootPath,
        "backend format check",
      ),
    );

    const packages = new Set(
      backendFiles.map((filePath) => findCargoPackageName(filePath, root)).filter(Boolean),
    );
    for (const packageName of packages) {
      const commonArgs = ["--package", packageName, "--all-targets", "--all-features"];
      fixCommands.push(
        command(
          "cargo",
          [
            "clippy",
            ...commonArgs.slice(0, 2),
            "--fix",
            "--allow-dirty",
            "--allow-staged",
            ...commonArgs.slice(2),
            "--",
            "-D",
            "warnings",
          ],
          rootPath,
          `Clippy fix (${packageName})`,
        ),
      );
      verifyCommands.push(
        command(
          "cargo",
          ["clippy", ...commonArgs, "--", "-D", "warnings"],
          rootPath,
          `Clippy check (${packageName})`,
        ),
      );
    }
  }

  return { targets: supportedTargets, fixCommands, verifyCommands };
}

function runCommand({ command: executable, args, cwd }) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function runQualityHook(event, root, { run = runCommand } = {}) {
  const plan = buildHookPlan(event, root);
  if (plan.fixCommands.length === 0) return { status: "skipped", plan, failures: [] };

  const failures = [];
  for (const hookCommand of [...plan.fixCommands, ...plan.verifyCommands]) {
    const result = await run(hookCommand);
    if (result.code !== 0) failures.push({ command: hookCommand, result });
  }
  return { status: failures.length === 0 ? "passed" : "failed", plan, failures };
}

function readStdin() {
  if (process.stdin.isTTY) return Promise.resolve("");
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function renderFailure(failure) {
  const { command: hookCommand, result } = failure;
  const renderedCommand = [hookCommand.command, ...hookCommand.args].join(" ");
  return [
    `[quality-hook] ${hookCommand.label} failed: ${renderedCommand}`,
    result.stdout.trim(),
    result.stderr.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const rawEvent = await readStdin();
  let event = {};
  try {
    event = rawEvent ? JSON.parse(rawEvent) : {};
  } catch {
    /* advisory hook: malformed input is ignored */
  }
  const result = await runQualityHook(event, process.cwd());
  if (result.status === "skipped") return;
  if (result.status === "passed") {
    process.stdout.write(`[quality-hook] fixed and verified: ${result.plan.targets.join(", ")}\n`);
    return;
  }
  process.stdout.write(`${result.failures.map(renderFailure).join("\n")}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => process.stdout.write(`[quality-hook] ${error.message}\n`));
}
