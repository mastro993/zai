import { join } from "path";
import { homedir } from "os";
import { unlink, readFile } from "fs/promises";
import { platform } from "process";

async function cleanDatabase() {
  // Read tauri.conf.json
  const tauriConfig = JSON.parse(
    await readFile(join("src-tauri", "tauri.conf.json"), "utf-8")
  );

  const appId = tauriConfig.identifier;
  const dbName = "zai.db";

  const basePath =
    platform === "win32"
      ? join(homedir(), "AppData", "Local", appId)
      : platform === "darwin"
        ? join(homedir(), "Library", "Application Support", appId)
        : join(homedir(), ".config", appId);

  const dbPath = join(basePath, dbName);

  console.log("Cleaning database at", dbPath);

  try {
    await unlink(dbPath);
    console.log("Database cleaned successfully");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Error cleaning database:", error);
    } else {
      console.log("Database file not found (already clean)");
    }
  }
}

cleanDatabase();
