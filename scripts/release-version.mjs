import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLACEHOLDER_VERSION = "0.0.0-dev";
export const BETA_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/;
export const STABLE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const calendarCoreFromIsoDate = (isoDate) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`Expected UTC date YYYY-MM-DD, got ${isoDate}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${year}.${month}.${day}`;
};

export const addUtcDays = (isoDate, days) => {
  const utc = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(utc.getTime())) {
    throw new Error(`Expected UTC date YYYY-MM-DD, got ${isoDate}`);
  }

  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
};

export const parseReleaseTag = (tag) => {
  const beta = BETA_TAG_PATTERN.exec(tag);
  if (beta) {
    return {
      kind: "beta",
      year: Number(beta[1]),
      month: Number(beta[2]),
      day: Number(beta[3]),
      n: Number(beta[4]),
      tag,
      version: `${beta[1]}.${Number(beta[2])}.${Number(beta[3])}-beta.${Number(beta[4])}`,
      core: `${beta[1]}.${Number(beta[2])}.${Number(beta[3])}`,
    };
  }

  const stable = STABLE_TAG_PATTERN.exec(tag);
  if (stable) {
    return {
      kind: "stable",
      year: Number(stable[1]),
      month: Number(stable[2]),
      day: Number(stable[3]),
      n: null,
      tag,
      version: `${stable[1]}.${Number(stable[2])}.${Number(stable[3])}`,
      core: `${stable[1]}.${Number(stable[2])}.${Number(stable[3])}`,
    };
  }

  return null;
};

export const compareReleaseTags = (left, right) => {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  if (left.month !== right.month) {
    return left.month - right.month;
  }
  if (left.day !== right.day) {
    return left.day - right.day;
  }
  if (left.kind !== right.kind) {
    return left.kind === "stable" ? 1 : -1;
  }
  return (left.n ?? 0) - (right.n ?? 0);
};

export const parsedReleaseTags = (tags) =>
  tags.flatMap((tag) => {
    const parsed = parseReleaseTag(tag);
    return parsed ? [parsed] : [];
  });

const maxParsed = (parsed) => {
  if (parsed.length === 0) {
    return null;
  }

  return parsed.reduce((current, next) => (compareReleaseTags(next, current) > 0 ? next : current));
};

export const previousReleaseTag = (tags) => maxParsed(parsedReleaseTags(tags))?.tag ?? null;

const stableExistsForCore = (parsed, core) =>
  parsed.some((tag) => tag.kind === "stable" && tag.core === core);

const betaCountForCore = (parsed, core) =>
  parsed.filter((tag) => tag.kind === "beta" && tag.core === core).length;

export const resolveBetaRelease = ({ today, tags, headSha, tagShas, allowSameHead = false }) => {
  const parsed = parsedReleaseTags(tags);
  const lastBeta = maxParsed(parsed.filter((tag) => tag.kind === "beta"));
  if (!allowSameHead && lastBeta && tagShas[lastBeta.tag] === headSha) {
    return { ok: true, skip: true };
  }

  let isoDate = today;
  let core = calendarCoreFromIsoDate(isoDate);
  while (stableExistsForCore(parsed, core)) {
    isoDate = addUtcDays(isoDate, 1);
    core = calendarCoreFromIsoDate(isoDate);
  }

  const n = betaCountForCore(parsed, core);
  const version = `${core}-beta.${n}`;
  return {
    ok: true,
    skip: false,
    channel: "beta",
    prerelease: true,
    version,
    tag: `v${version}`,
  };
};

export const resolveStableRelease = ({ today, tags }) => {
  const core = calendarCoreFromIsoDate(today);
  const parsed = parsedReleaseTags(tags);
  if (stableExistsForCore(parsed, core)) {
    return { ok: false, reason: `Stable tag v${core} already exists for ${today}` };
  }

  return {
    ok: true,
    skip: false,
    channel: "stable",
    prerelease: false,
    version: core,
    tag: `v${core}`,
  };
};

export const formatReleaseNotes = ({ commits, sha, builtOn }) => {
  const items =
    commits.length === 0
      ? "- No non-merge commits since the previous tag."
      : commits.map((commit) => `- ${commit}`).join("\n");

  return `## What's Changed

${items}

---
*Built from \`${sha}\` on ${builtOn}*
`;
};

const git = (args, cwd = rootDir) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const listGitTags = (cwd) => {
  const output = git(["tag", "--list", "v*"], cwd);
  return output === "" ? [] : output.split("\n");
};

const tagCommit = (tag, cwd) => git(["rev-list", "-n", "1", tag], cwd);

const commitLog = (sinceTag, cwd) => {
  const args = sinceTag
    ? ["log", "--oneline", "--no-merges", `${sinceTag}..HEAD`]
    : ["log", "--oneline", "--no-merges", "-100"];
  const output = git(args, cwd);
  return output === "" ? [] : output.split("\n");
};

const utcToday = () => new Date().toISOString().slice(0, 10);

export const stampVersion = (version, cwd = rootDir) => {
  const cargoTomlPath = path.join(cwd, "Cargo.toml");
  const cargoToml = readFileSync(cargoTomlPath, "utf8");
  const nextCargoToml = cargoToml.replace(
    /(\[workspace\.package\][\s\S]*?^version = ")[^"]+(")/m,
    `$1${version}$2`,
  );
  if (nextCargoToml === cargoToml) {
    throw new Error("Failed to stamp workspace package version in Cargo.toml");
  }
  writeFileSync(cargoTomlPath, nextCargoToml);

  for (const relativePath of ["package.json", "apps/frontend/package.json", "apps/tauri/tauri.conf.json"]) {
    const filePath = path.join(cwd, relativePath);
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    data.version = version;
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  }
};

const writeGithubOutput = (values) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);
    return;
  }

  const lines = Object.entries(values).flatMap(([key, value]) => {
    const text = String(value);
    if (text.includes("\n")) {
      return [`${key}<<EOF`, text, "EOF"];
    }
    return [`${key}=${text}`];
  });
  writeFileSync(outputPath, `${lines.join("\n")}\n`, { flag: "a" });
};

const runGithubOutput = () => {
  const channel = process.env.RELEASE_CHANNEL;
  if (channel !== "beta" && channel !== "stable") {
    throw new Error(`RELEASE_CHANNEL must be beta or stable, got ${channel}`);
  }

  const today = process.env.RELEASE_TODAY ?? utcToday();
  const cwd = process.env.RELEASE_GIT_DIR ?? rootDir;
  const tags = listGitTags(cwd);
  const headSha = git(["rev-parse", "HEAD"], cwd);
  const parsedBetas = parsedReleaseTags(tags).filter((tag) => tag.kind === "beta");
  const tagShas = Object.fromEntries(parsedBetas.map((tag) => [tag.tag, tagCommit(tag.tag, cwd)]));

  const allowSameHead = process.env.RELEASE_ALLOW_SAME_HEAD === "true";
  const resolved =
    channel === "beta"
      ? resolveBetaRelease({ today, tags, headSha, tagShas, allowSameHead })
      : resolveStableRelease({ today, tags });

  if (!resolved.ok) {
    throw new Error(resolved.reason);
  }

  if (resolved.skip) {
    writeGithubOutput({
      skip: "true",
      version: "",
      tag: "",
      prerelease: "false",
      notes: "",
      sha: headSha,
    });
    return;
  }

  const previousTag = previousReleaseTag(tags);
  const notes = formatReleaseNotes({
    commits: commitLog(previousTag, cwd),
    sha: git(["rev-parse", "--short", "HEAD"], cwd),
    builtOn: today,
  });

  writeGithubOutput({
    skip: "false",
    version: resolved.version,
    tag: resolved.tag,
    prerelease: resolved.prerelease ? "true" : "false",
    notes,
    sha: headSha,
  });
};

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const command = process.argv[2];
  if (command === "github-output") {
    runGithubOutput();
  } else if (command === "stamp") {
    const version = process.argv[3];
    if (!version) {
      throw new Error("usage: node scripts/release-version.mjs stamp <version>");
    }
    stampVersion(version);
  } else {
    throw new Error("usage: node scripts/release-version.mjs github-output|stamp <version>");
  }
}
