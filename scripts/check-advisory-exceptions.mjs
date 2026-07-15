import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const parseOsvExceptions = (contents) => {
  const exceptions = [];
  const blocks = contents.split("[[IgnoredVulns]]").slice(1);
  for (const block of blocks) {
    const id = block.match(/^id\s*=\s*"([^"]+)"/m)?.[1];
    const ignoreUntil = block.match(/^ignoreUntil\s*=\s*(\d{4}-\d{2}-\d{2})/m)?.[1];
    const reason = block.match(/^reason\s*=\s*"([^"]+)"/m)?.[1];
    if (!id || !ignoreUntil || !reason) {
      fail(`Invalid osv-scanner exception block for ${id ?? "unknown id"}`);
    }
    if (!reason.includes("owner=")) {
      fail(`osv-scanner exception ${id} must include owner= in reason`);
    }
    exceptions.push({ id, expires: ignoreUntil, owner: reason.match(/owner=([^|]+)/)?.[1]?.trim() });
  }
  return exceptions;
};

const parseDenyExceptions = (contents) => {
  const exceptions = [];
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const commentMatch = line.match(/#\s*expires=(\d{4}-\d{2}-\d{2})\s+owner=([^\s]+)/);
    if (!commentMatch) {
      continue;
    }
    const entry = lines[index + 1] ?? "";
    const id = entry.match(/id\s*=\s*"([^"]+)"/)?.[1];
    const reason = entry.match(/reason\s*=\s*"([^"]+)"/)?.[1];
    if (!id || !reason) {
      fail(`deny.toml exception after ${line} is missing id or reason`);
    }
    exceptions.push({ id, expires: commentMatch[1], owner: commentMatch[2] });
  }
  return exceptions;
};

const validateExceptions = (exceptions, source) => {
  for (const exception of exceptions) {
    if (!exception.owner) {
      fail(`${source} exception ${exception.id} is missing owner`);
    }
    if (exception.expires < today) {
      fail(`${source} exception ${exception.id} expired on ${exception.expires}`);
    }
  }
};

const osvContents = readFileSync(path.join(rootDir, "osv-scanner.toml"), "utf8");
const denyContents = readFileSync(path.join(rootDir, "deny.toml"), "utf8");

validateExceptions(parseOsvExceptions(osvContents), "osv-scanner.toml");
validateExceptions(parseDenyExceptions(denyContents), "deny.toml");

console.log("Advisory exceptions are documented, owned, and unexpired.");
