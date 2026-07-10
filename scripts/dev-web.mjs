import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const loadEnvFile = (relativePath) => {
  const envPath = path.join(rootDir, relativePath);
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key.length > 0 && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.web");

const apiOrigin = process.env.VITE_ZAI_API_ORIGIN ?? "http://127.0.0.1:3000";
const usesTempDataDir = !process.env.ZAI_DATA_DIR;
const dataDir =
  process.env.ZAI_DATA_DIR ?? (await mkdtemp(path.join(tmpdir(), "zai-web-dev-")));

const sharedEnv = {
  ...process.env,
  ZAI_DATA_DIR: dataDir,
  VITE_ZAI_API_ORIGIN: apiOrigin,
};

const children = [];

const run = (command, args) => {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: sharedEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  return child;
};

const stopChildren = (signal = "SIGTERM") => {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

const removeTempDataDir = async () => {
  if (!usesTempDataDir) {
    return;
  }

  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
};

const shutdown = async (exitCode = 0) => {
  stopChildren();
  await removeTempDataDir();
  process.exit(exitCode);
};

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});

console.log(`Zai web dev using data directory: ${dataDir}`);
console.log(`API origin: ${apiOrigin}`);

const server = run("cargo", ["run", "-p", "zai-server"]);
const frontend = run("pnpm", ["--filter", "frontend", "dev:web"]);

server.on("exit", (code, signal) => {
  if (signal) {
    return;
  }
  void shutdown(code ?? 0);
});

frontend.on("exit", (code, signal) => {
  if (signal) {
    return;
  }
  void shutdown(code ?? 0);
});
