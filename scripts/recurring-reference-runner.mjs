import { execFile, spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { arch, cpus, platform, release, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binary = path.join(root, "target", "debug", "recurring-reference-runner");
const build = spawnSync("cargo", ["build", "-p", "zai-db", "--bin", "recurring-reference-runner"], {
  cwd: root,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const child = spawn(binary, [], {
  cwd: root,
  env: { ...process.env, ZAI_REFERENCE_RUNNER_WAIT: "1" },
  stdio: ["pipe", "pipe", "pipe"],
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

const readWorkingSetKiB = () =>
  new Promise((resolve) => {
    if (process.platform === "linux") {
      readFile(`/proc/${child.pid}/status`, "utf8")
        .then((status) => {
          const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
          resolve(match ? Number.parseInt(match[1], 10) : null);
        })
        .catch(() => resolve(null));
      return;
    }
    if (process.platform !== "darwin") {
      resolve(null);
      return;
    }
    execFile("vmmap", ["-summary", String(child.pid)], (error, output) => {
      if (error) {
        resolve(null);
        return;
      }
      const match = output.match(/Physical footprint:\s+([\d.]+)([KMG])/);
      if (!match) {
        resolve(null);
        return;
      }
      const multiplier = { K: 1, M: 1024, G: 1024 * 1024 }[match[2]];
      resolve(Number.parseFloat(match[1]) * multiplier);
    });
  });

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(new Error("reference runner did not become ready")),
      60_000,
    );
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const onData = (chunk) => {
      if (chunk.includes("READY")) {
        finish();
      }
    };
    const onError = (error) => finish(error);
    const onExit = (code, signal) =>
      finish(new Error(`reference runner exited before READY (code=${code}, signal=${signal})`));
    child.stdout.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
} catch (error) {
  child.kill();
  throw error;
}

let baseline = await readWorkingSetKiB();
let peak = baseline ?? 0;
let sampling = false;
const sample = async () => {
  if (sampling) {
    return;
  }
  sampling = true;
  const workingSet = await readWorkingSetKiB();
  if (workingSet !== null) {
    baseline ??= workingSet;
    peak = Math.max(peak, workingSet);
  }
  sampling = false;
};
const sampler = setInterval(() => void sample(), 100);
const started = performance.now();
let timedOut = false;
const benchmarkTimeout = setTimeout(() => {
  timedOut = true;
  child.kill("SIGKILL");
}, 60_000);
child.stdin.write("go\n");
const [exitCode, signal] = await once(child, "exit");
clearTimeout(benchmarkTimeout);
clearInterval(sampler);
await sample();

const elapsedMs = performance.now() - started;
const growthKiB = peak - (baseline ?? peak);
const processed = stdout.match(/processed=(\d+)/)?.[1];
console.log(stdout.trim());
console.log(
  `reference_platform=${platform()} reference_arch=${arch()} reference_os_release=${release()} reference_cpu_model=${cpus()[0]?.model ?? "unknown"} reference_host_memory_mib=${Math.round(totalmem() / 1024 / 1024)}`,
);
console.log(
  `reference_elapsed_ms=${Math.round(elapsedMs)} reference_working_set_growth_kib=${Math.round(growthKiB)}`,
);

if (timedOut) {
  throw new Error("reference runner exceeded 60 seconds");
}
if (signal || exitCode !== 0) {
  console.error(stderr.trim());
  process.exit(exitCode ?? 1);
}
if (processed !== "10000") {
  throw new Error(`reference runner processed ${processed ?? "unknown"} occurrences`);
}
if (baseline === null) {
  throw new Error(`reference runner could not measure working set on ${process.platform}`);
}
if (elapsedMs > 60_000) {
  throw new Error(`reference runner exceeded 60 seconds: ${Math.round(elapsedMs)} ms`);
}
if (growthKiB > 64 * 1024) {
  throw new Error(`reference runner exceeded 64 MiB growth: ${growthKiB} KiB`);
}
