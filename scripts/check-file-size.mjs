import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_LINES = 400;
const SCAN_ROOTS = ["apps", "crates", "scripts"];
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".rs", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set(["dist", "node_modules", "target"]);

const normalizePath = (path) => path.split(sep).join("/");

const countLines = (content) => {
  if (content.length === 0) {
    return 0;
  }

  return content.replace(/\r?\n$/, "").split(/\r?\n/).length;
};

const isProductionFile = (path) => {
  if (!SOURCE_EXTENSIONS.has(extname(path))) {
    return false;
  }

  const segments = path.split("/");
  const fileName = segments.at(-1) ?? "";
  if (
    segments.includes("__tests__") ||
    segments.includes("node_modules") ||
    segments.includes("target") ||
    segments.includes("dist") ||
    segments.includes("tests") ||
    path.includes("/components/ui/") ||
    fileName.includes(".test.") ||
    fileName.includes(".spec.") ||
    fileName.endsWith("_test.rs") ||
    fileName.endsWith("_tests.rs") ||
    fileName.includes(".gen.")
  ) {
    return false;
  }

  return true;
};

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        return [];
      }
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );
  return nested.flat();
};

export const findOversizedProductionFiles = async ({ root, exceptions }) => {
  const files = (
    await Promise.all(SCAN_ROOTS.map((directory) => collectFiles(join(root, directory))))
  ).flat();
  const violations = [];

  for (const file of files) {
    const path = normalizePath(relative(root, file));
    if (!isProductionFile(path) || exceptions[path]) {
      continue;
    }

    const lineCount = countLines(await readFile(file, "utf8"));
    if (lineCount > MAX_LINES) {
      violations.push({ lineCount, path });
    }
  }

  return violations.toSorted((left, right) => left.path.localeCompare(right.path));
};

const run = async () => {
  const rootArgumentIndex = process.argv.indexOf("--root");
  const rootArgument = rootArgumentIndex === -1 ? undefined : process.argv[rootArgumentIndex + 1];
  if (rootArgumentIndex !== -1 && !rootArgument) {
    throw new Error("--root requires a path");
  }
  const root = rootArgument ? resolve(rootArgument) : process.cwd();
  const exceptions = JSON.parse(
    await readFile(join(root, "scripts/file-size-exceptions.json"), "utf8"),
  );
  const undocumented = Object.entries(exceptions).filter(
    ([, exception]) => typeof exception.reason !== "string" || exception.reason.trim() === "",
  );
  if (undocumented.length > 0) {
    for (const [path] of undocumented) {
      console.error(`${path}: file-size exception needs a reason`);
    }
    process.exitCode = 1;
    return;
  }

  const violations = await findOversizedProductionFiles({ root, exceptions });
  if (violations.length === 0) {
    console.log(`Production files stay within ${MAX_LINES} lines.`);
    return;
  }

  for (const violation of violations) {
    console.error(`${violation.path}: ${violation.lineCount} lines (max ${MAX_LINES})`);
  }
  process.exitCode = 1;
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await run();
}
