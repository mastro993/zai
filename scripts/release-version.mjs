import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLACEHOLDER_VERSION = "0.0.0-dev";
export const NIGHTLY_TAG_PATTERN = /^nightly-(\d{4})\.(\d+)\.(\d+)\.(\d+)$/;
export const STABLE_TAG_PATTERN = /^(\d{4})\.(\d+)\.(\d+)\.(\d+)$/;
export const MAX_DAILY_BUILD = 999;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const parseNumericParts = (match, requireUnpadded = true) => {
  const raw = match.slice(1);
  const parts = raw.map(Number);
  if (
    parts.some(
      (part, index) =>
        !Number.isSafeInteger(part) || (requireUnpadded && String(part) !== raw[index]),
    )
  ) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return parts;
};

export const calendarCoreFromIsoDate = (isoDate) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const parts = match && parseNumericParts(match, false);
  if (!parts) {
    throw new Error(`Expected valid UTC date YYYY-MM-DD, got ${isoDate}`);
  }
  return parts.slice(0, 3).join(".");
};

export const parseReleaseTag = (tag) => {
  const kind = tag.startsWith("nightly-") ? "nightly" : "stable";
  const match = (kind === "nightly" ? NIGHTLY_TAG_PATTERN : STABLE_TAG_PATTERN).exec(tag);
  const parts = match && parseNumericParts(match);
  if (!parts) {
    return null;
  }

  const [year, month, day, build] = parts;
  const version = `${year}.${month}.${day}.${build}`;
  return { kind, year, month, day, build, tag, version, core: `${year}.${month}.${day}` };
};

export const compareReleaseTags = (left, right) =>
  left.year - right.year ||
  left.month - right.month ||
  left.day - right.day ||
  left.build - right.build;

export const parsedReleaseTags = (tags) =>
  tags.flatMap((tag) => {
    const parsed = parseReleaseTag(tag);
    return parsed ? [parsed] : [];
  });

const maxParsed = (parsed) =>
  parsed.length === 0
    ? null
    : parsed.reduce((current, next) => (compareReleaseTags(next, current) > 0 ? next : current));

export const previousReleaseTag = (tags, channel) =>
  maxParsed(parsedReleaseTags(tags).filter((tag) => tag.kind === channel))?.tag ?? null;

const releaseVersionParts = (version) => {
  const match = /^(\d{4})\.(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const parts = match && parseNumericParts(match);
  if (!parts) {
    throw new Error(`Expected release version YYYY.M.D.B, got ${version}`);
  }

  const build = parts[3];
  if (build > MAX_DAILY_BUILD) {
    throw new Error(
      `Release build ${build} exceeds the supported daily maximum of ${MAX_DAILY_BUILD}`,
    );
  }
  return parts;
};

export const packageVersionFromReleaseVersion = (version) => {
  const [year, month, day, build] = releaseVersionParts(version);

  // ponytail: The 999-build/day ceiling is intentional; widening/revisiting
  // this encoding is the upgrade path.
  return `${year}.${month}.${day * 1000 + build}`;
};

export const releaseVersionFromPackageVersion = (packageVersion) => {
  const match = /^(\d{4})\.(\d+)\.(\d+)$/.exec(packageVersion);
  if (!match) {
    return null;
  }
  const [year, month, patch] = match.slice(1).map(Number);
  const version = `${year}.${month}.${Math.floor(patch / 1000)}.${patch % 1000}`;
  return parseReleaseTag(version)?.version ?? null;
};

export const resolveRelease = ({ channel, today, tags, committedVersion = null }) => {
  if (channel !== "nightly" && channel !== "stable") {
    throw new Error(`Release channel must be nightly or stable, got ${channel}`);
  }

  const previousTag = previousReleaseTag(tags, channel);
  const core = calendarCoreFromIsoDate(today);
  const committed = committedVersion ? parseReleaseTag(committedVersion) : null;
  const build = committed?.core === core ? committed.build + 1 : 0;
  if (!Number.isSafeInteger(build)) {
    throw new Error(`Release build sequence overflow for ${core}`);
  }
  if (build > MAX_DAILY_BUILD) {
    throw new Error(
      `Release build sequence for ${core} exceeds the supported daily maximum of ${MAX_DAILY_BUILD}`,
    );
  }

  const version = `${core}.${build}`;
  return {
    ok: true,
    channel,
    prerelease: channel === "nightly",
    previousTag,
    version,
    packageVersion: packageVersionFromReleaseVersion(version),
    tag: channel === "nightly" ? `nightly-${version}` : version,
  };
};

const git = (args, cwd = rootDir) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const listGitTags = (cwd) => {
  const output = git(["tag", "--list"], cwd);
  return output === "" ? [] : output.split("\n");
};

const utcToday = () => new Date().toISOString().slice(0, 10);

export const stampVersion = (version, cwd = rootDir) => {
  if (!/^\d{4}\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)) {
    throw new Error(
      `Expected packed package version Y.M.P without a prerelease suffix, got ${version}`,
    );
  }

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

  for (const relativePath of [
    "package.json",
    "apps/frontend/package.json",
    "apps/tauri/tauri.conf.json",
  ]) {
    const filePath = path.join(cwd, relativePath);
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    data.version = version;
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  }
};

const matchingFiles = (directory, predicate) => {
  const matches = [];
  const visit = (currentDirectory) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const filePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (predicate(entry.name)) {
        matches.push(filePath);
      }
    }
  };
  visit(directory);
  return matches;
};

const findSingleFile = (directory, predicate, description) => {
  const matches = matchingFiles(directory, predicate);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${description}, found ${matches.length}`);
  }
  return matches[0];
};

export const validateReleaseAssets = (releaseVersion, assetsDirectory) => {
  releaseVersionParts(releaseVersion);
  const expected = [
    [2, (name) => name.includes(releaseVersion) && name.endsWith(".dmg"), "macOS DMGs"],
    [1, (name) => name.includes(releaseVersion) && name.endsWith(".deb"), "Linux DEB"],
    [1, (name) => name.includes(releaseVersion) && name.endsWith(".rpm"), "Linux RPM"],
    [1, (name) => name.includes(releaseVersion) && name.endsWith(".AppImage"), "Linux AppImage"],
    [1, (name) => name.includes(releaseVersion) && name.endsWith("-setup.exe"), "Windows NSIS installer"],
  ];
  for (const [count, predicate, description] of expected) {
    const actual = matchingFiles(assetsDirectory, predicate).length;
    if (actual !== count) {
      throw new Error(`Expected exactly ${count} ${description}, found ${actual}`);
    }
  }
  return true;
};

export const createUpdaterManifests = ({
  channel,
  releaseVersion,
  packageVersion,
  releaseTag,
  repository,
  assetsDirectory,
  outputDirectory,
  publishedAt = process.env.RELEASE_PUBLISHED_AT ?? new Date().toISOString(),
}) => {
  if (channel !== "nightly" && channel !== "stable") {
    throw new Error(`Release channel must be nightly or stable, got ${channel}`);
  }
  if (packageVersion !== packageVersionFromReleaseVersion(releaseVersion)) {
    throw new Error(`Package version does not match release version ${releaseVersion}`);
  }
  const parsedTag = parseReleaseTag(releaseTag);
  if (!parsedTag || parsedTag.kind !== channel || parsedTag.version !== releaseVersion) {
    throw new Error(`Release tag ${releaseTag} does not match ${channel} ${releaseVersion}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`Expected GitHub repository owner/name, got ${repository}`);
  }

  const targets = [
    {
      id: "macos-aarch64",
      matches: (name) => name.endsWith(`_${releaseVersion}_aarch64.app.tar.gz`),
      description: "macOS aarch64 updater archive",
    },
    {
      id: "macos-x86_64",
      matches: (name) => name.endsWith(`_${releaseVersion}_x86_64.app.tar.gz`),
      description: "macOS x86_64 updater archive",
    },
    {
      id: "linux-x86_64",
      matches: (name) => name.includes(releaseVersion) && name.endsWith(".AppImage"),
      description: "Linux x86_64 updater AppImage",
    },
    {
      id: "windows-x86_64",
      matches: (name) => name.includes(releaseVersion) && name.endsWith("-setup.exe"),
      description: "Windows x86_64 updater installer",
    },
  ];

  mkdirSync(outputDirectory, { recursive: true });
  return targets.map((target) => {
    const assetPath = findSingleFile(assetsDirectory, target.matches, target.description);
    const signaturePath = `${assetPath}.sig`;
    if (!existsSync(signaturePath)) {
      throw new Error(`Missing updater signature ${signaturePath}`);
    }
    const signature = readFileSync(signaturePath, "utf8").trim();
    if (!signature) {
      throw new Error(`Updater signature is empty: ${signaturePath}`);
    }

    const manifestTarget = `${channel}-${target.id}`;
    const assetName = path.basename(assetPath);
    const manifestPath = path.join(outputDirectory, `${manifestTarget}.json`);
    const manifest = {
      version: packageVersion,
      notes: `${channel === "nightly" ? "Nightly" : "Stable"} release ${releaseVersion}`,
      pub_date: publishedAt,
      platforms: {
        [manifestTarget]: {
          signature,
          url: `https://github.com/${repository}/releases/download/${encodeURIComponent(releaseTag)}/${encodeURIComponent(assetName)}`,
        },
      },
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return manifestPath;
  });
};

export const renameArtifactVersions = (
  releaseVersion,
  packageVersion,
  directory = path.join(rootDir, "target"),
  macUpdaterArchitecture,
) => {
  const expectedPackageVersion = packageVersionFromReleaseVersion(releaseVersion);
  if (packageVersion !== expectedPackageVersion) {
    throw new Error(
      `Expected package version ${expectedPackageVersion} for release ${releaseVersion}, got ${packageVersion}`,
    );
  }

  let renamed = 0;
  const visit = (currentDirectory) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const sourcePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath);
        continue;
      }
      if (!entry.name.includes(packageVersion)) {
        continue;
      }

      const destinationPath = path.join(
        currentDirectory,
        entry.name.replaceAll(packageVersion, releaseVersion),
      );
      if (existsSync(destinationPath)) {
        throw new Error(`Cannot rename artifact because ${destinationPath} already exists`);
      }
      renameSync(sourcePath, destinationPath);
      renamed += 1;
    }
  };

  visit(directory);
  if (macUpdaterArchitecture) {
    const updaterArchives = [];
    const findUpdater = (currentDirectory) => {
      for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
        const filePath = path.join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
          findUpdater(filePath);
        } else if (entry.name.endsWith(".app.tar.gz")) {
          updaterArchives.push(filePath);
        }
      }
    };
    findUpdater(directory);
    if (updaterArchives.length !== 1) {
      throw new Error(
        `Expected exactly one macOS updater archive, found ${updaterArchives.length}`,
      );
    }

    const sourcePath = updaterArchives[0];
    const signaturePath = `${sourcePath}.sig`;
    if (!existsSync(signaturePath)) {
      throw new Error(`Missing macOS updater signature ${signaturePath}`);
    }

    const archiveSuffix = ".app.tar.gz";
    const archiveName = path.basename(sourcePath, archiveSuffix);
    const destinationPath = path.join(
      path.dirname(sourcePath),
      `${archiveName}_${releaseVersion}_${macUpdaterArchitecture}${archiveSuffix}`,
    );
    const destinationSignaturePath = `${destinationPath}.sig`;
    for (const outputPath of [destinationPath, destinationSignaturePath]) {
      if (existsSync(outputPath)) {
        throw new Error(`Cannot rename artifact because ${outputPath} already exists`);
      }
    }

    renameSync(sourcePath, destinationPath);
    renameSync(signaturePath, destinationSignaturePath);
    renamed += 2;
  }
  if (renamed === 0) {
    throw new Error(`No artifact filenames contained package version ${packageVersion}`);
  }
  return renamed;
};

const writeGithubOutput = (values) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);
    return;
  }

  writeFileSync(
    outputPath,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("\n")}\n`,
    { flag: "a" },
  );
};

const runGithubOutput = () => {
  const channel = process.env.RELEASE_CHANNEL;
  const today = process.env.RELEASE_TODAY ?? utcToday();
  const cwd = process.env.RELEASE_GIT_DIR ?? rootDir;
  const tags = listGitTags(cwd);
  const headSha = git(["rev-parse", "HEAD"], cwd);
  const cargoToml = readFileSync(path.join(cwd, "Cargo.toml"), "utf8");
  const packageMatch = /\[workspace\.package\][\s\S]*?^version = "([^"]+)"/m.exec(cargoToml);
  const committedVersion = packageMatch
    ? releaseVersionFromPackageVersion(packageMatch[1])
    : null;
  const resolved = resolveRelease({ channel, today, tags, committedVersion });

  writeGithubOutput({
    channel,
    version: resolved.version,
    package_version: resolved.packageVersion,
    tag: resolved.tag,
    prerelease: resolved.prerelease ? "true" : "false",
    previous_tag: resolved.previousTag ?? "",
    sha: headSha,
  });
};

const isCli =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

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
  } else if (command === "rename-artifacts") {
    const releaseVersion = process.argv[3];
    const packageVersion = process.argv[4];
    const directory = process.argv[5];
    const macUpdaterArchitecture = process.argv[6];
    if (!releaseVersion || !packageVersion || !directory) {
      throw new Error(
        "usage: node scripts/release-version.mjs rename-artifacts <release-version> <package-version> <directory> [mac-updater-architecture]",
      );
    }
    renameArtifactVersions(releaseVersion, packageVersion, directory, macUpdaterArchitecture);
  } else if (command === "verify-assets") {
    const releaseVersion = process.argv[3];
    const assetsDirectory = process.argv[4];
    if (!releaseVersion || !assetsDirectory) {
      throw new Error("usage: node scripts/release-version.mjs verify-assets <release-version> <assets-directory>");
    }
    validateReleaseAssets(releaseVersion, assetsDirectory);
  } else if (command === "updater-manifests") {
    const [
      channel,
      releaseVersion,
      packageVersion,
      releaseTag,
      repository,
      assetsDirectory,
      outputDirectory,
    ] = process.argv.slice(3);
    if (
      !channel ||
      !releaseVersion ||
      !packageVersion ||
      !releaseTag ||
      !repository ||
      !assetsDirectory ||
      !outputDirectory
    ) {
      throw new Error(
        "usage: node scripts/release-version.mjs updater-manifests <channel> <release-version> <package-version> <release-tag> <repository> <assets-directory> <output-directory>",
      );
    }
    createUpdaterManifests({
      channel,
      releaseVersion,
      packageVersion,
      releaseTag,
      repository,
      assetsDirectory,
      outputDirectory,
    });
  } else {
    throw new Error(
      "usage: node scripts/release-version.mjs github-output|stamp <version>|rename-artifacts <release-version> <package-version> <directory> [mac-updater-architecture]|verify-assets <release-version> <assets-directory>|updater-manifests <channel> <release-version> <package-version> <release-tag> <repository> <assets-directory> <output-directory>",
    );
  }
}
