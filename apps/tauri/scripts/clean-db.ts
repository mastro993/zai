import { isAbsolute, join } from "path";
import { homedir } from "os";
import { unlink } from "fs/promises";

async function cleanDatabase() {
  const zaiHome = process.env.ZAI_HOME ?? join(homedir(), ".zai");
  if (!isAbsolute(zaiHome)) {
    throw new Error("ZAI_HOME must be an absolute path");
  }

  const dbPath = join(zaiHome, "userdata", "zai.db");

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
