#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MAX_LINES = 400;

const INCLUDE_ROOTS = [
  "apps/frontend/src",
  "apps/server/src",
  "apps/tauri/src",
  "crates",
];

const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  "target",
  "dist",
  "components/ui",
  "__tests__",
  "migrations",
  "fixtures",
]);

const EXCLUDE_PATH_FRAGMENTS = [
  "/components/ui/",
  "/__tests__/",
  "/migrations/",
  "/fixtures/",
  "routeTree.gen.ts",
];

const EXCLUDE_FILE_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
  "_tests.rs",
];

// Pre-existing oversized modules outside plan 018 scope. New exceptions require
// an explicit decision; prefer splitting instead of extending this list.
const ALLOWED_EXCEPTIONS = new Set([
  "apps/frontend/src/commands/web-command-map.ts",
  "apps/server/src/api/cash_flow/transactions.rs",
  "crates/core/src/errors.rs",
  "crates/core/src/features/transaction_categories/service.rs",
  "crates/core/src/features/transactions/service.rs",
  "crates/db/src/budgets/projection.rs",
]);

const PRODUCTION_EXTENSIONS = new Set([".ts", ".tsx", ".rs"]);

function shouldSkipDir(name, relativeDir) {
  if (EXCLUDE_DIR_NAMES.has(name)) {
    return true;
  }
  if (name === "ui" && relativeDir.endsWith("components")) {
    return true;
  }
  return false;
}

function shouldSkipFile(relativePath) {
  if (ALLOWED_EXCEPTIONS.has(relativePath)) {
    return false;
  }
  if (EXCLUDE_PATH_FRAGMENTS.some((fragment) => relativePath.includes(fragment))) {
    return true;
  }
  if (EXCLUDE_FILE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix))) {
    return true;
  }
  return false;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    const rel = relative(ROOT, absolute).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      const parentRel = relative(ROOT, dir).replaceAll("\\", "/");
      if (shouldSkipDir(entry.name, parentRel)) {
        continue;
      }
      walk(absolute, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const ext = entry.name.includes(".")
      ? `.${entry.name.split(".").pop()}`
      : "";
    if (!PRODUCTION_EXTENSIONS.has(ext)) {
      continue;
    }
    if (shouldSkipFile(rel)) {
      continue;
    }
    files.push(rel);
  }
  return files;
}

function countLines(relativePath) {
  const content = readFileSync(join(ROOT, relativePath), "utf8");
  if (content.length === 0) {
    return 0;
  }
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

const files = INCLUDE_ROOTS.flatMap((root) => {
  const absolute = join(ROOT, root);
  try {
    if (!statSync(absolute).isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }
  return walk(absolute);
});

const offenders = [];
for (const file of files) {
  if (ALLOWED_EXCEPTIONS.has(file)) {
    continue;
  }
  const lines = countLines(file);
  if (lines > MAX_LINES) {
    offenders.push({ file, lines });
  }
}

offenders.sort((a, b) => b.lines - a.lines);

if (offenders.length > 0) {
  console.error(`Production files over ${MAX_LINES} lines:`);
  for (const { file, lines } of offenders) {
    console.error(`  ${lines}\t${file}`);
  }
  process.exit(1);
}

console.log(
  `File size check passed (${files.length} production files, max ${MAX_LINES} lines).`,
);
