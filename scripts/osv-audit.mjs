import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockingFindings } from "./advisory-utils.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OSV_SCANNER_VERSION = "2.3.8";

const platformMap = {
  "darwin:arm64": "darwin_arm64",
  "darwin:x64": "darwin_amd64",
  "linux:arm64": "linux_arm64",
  "linux:x64": "linux_amd64",
};

const resolvePlatform = () => {
  const key = `${process.platform}:${process.arch}`;
  const resolved = platformMap[key];
  if (!resolved) {
    console.error(`Unsupported platform for osv-scanner: ${key}`);
    process.exit(1);
  }
  return resolved;
};

const sha256File = async (filePath) => {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
};

const downloadOsvScanner = async () => {
  const installDir = process.env.OSV_SCANNER_DIR ?? path.join(rootDir, ".cache", "osv-scanner");
  const binaryPath = path.join(installDir, "osv-scanner");
  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  mkdirSync(installDir, { recursive: true });
  const platform = resolvePlatform();
  const baseUrl = `https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}`;
  const binaryName = `osv-scanner_${platform}`;
  const sumsResponse = await fetch(`${baseUrl}/osv-scanner_SHA256SUMS`);
  if (!sumsResponse.ok) {
    console.error(`Failed to fetch osv-scanner checksums: ${sumsResponse.status}`);
    process.exit(1);
  }

  const sumsText = await sumsResponse.text();
  const expectedHash = sumsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .find((parts) => parts[1] === binaryName)?.[0];

  if (!expectedHash) {
    console.error(`Checksum for ${binaryName} not found in release manifest`);
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/${binaryName}`);
  if (!response.ok) {
    console.error(`Failed to download osv-scanner: ${response.status}`);
    process.exit(1);
  }

  await pipeline(response.body, createWriteStream(binaryPath));
  chmodSync(binaryPath, 0o755);

  const actualHash = await sha256File(binaryPath);
  if (actualHash !== expectedHash) {
    console.error(`osv-scanner checksum mismatch: expected ${expectedHash}, got ${actualHash}`);
    process.exit(1);
  }

  return binaryPath;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let minSeverity = "high";
  const lockfiles = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--min-severity") {
      minSeverity = args[index + 1] ?? "high";
      index += 1;
      continue;
    }
    lockfiles.push(path.resolve(rootDir, arg));
  }

  if (lockfiles.length === 0) {
    lockfiles.push(path.join(rootDir, "pnpm-lock.yaml"));
  }

  return { minSeverity: minSeverity.toUpperCase(), lockfiles };
};

const main = async () => {
  const { minSeverity, lockfiles } = parseArgs();
  const binaryPath = await downloadOsvScanner();
  const configPath = path.join(rootDir, "osv-scanner.toml");
  const scannerArgs = [
    "scan",
    "source",
    `--config=${configPath}`,
    "--format=json",
    ...lockfiles.flatMap((lockfile) => ["--lockfile", lockfile]),
  ];

  const result = spawnSync(binaryPath, scannerArgs, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    console.error(`Failed to run osv-scanner: ${result.error.message}`);
    process.exit(1);
  }

  if (result.stderr?.trim()) {
    process.stderr.write(result.stderr);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error("osv-scanner returned invalid JSON");
    if (result.stdout) {
      console.error(result.stdout.slice(0, 500));
    }
    process.exit(1);
  }

  const blocking = blockingFindings(report, minSeverity);

  if (blocking.length > 0) {
    console.error(
      `Found ${blocking.length} ${minSeverity}+ advisories in JavaScript lockfiles:`,
    );
    for (const finding of blocking) {
      console.error(`- ${finding.id} (${finding.severity}) in ${finding.package}`);
    }
    process.exit(1);
  }

  const ignoredConfig = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  if (ignoredConfig.includes("registry.npmjs.org/-/npm/v1/security/audits")) {
    console.error("osv-scanner config must not reference deprecated npm audit endpoints");
    process.exit(1);
  }

  console.log(
    `osv-scanner: no ${minSeverity}+ advisories in ${lockfiles.map((file) => path.basename(file)).join(", ")}`,
  );
};

await main();
