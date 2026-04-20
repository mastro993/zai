import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  FileProcessorError,
  FileReadError,
  InvalidFileExtensionError,
  NoFilePathError,
} from "./error";
import { getParser } from "./parser";
import { Result } from "@praha/byethrow";
import type { AcceptedFileExtension } from "./types";
import { AcceptedFileExtensions } from "./types";
import { getFilter } from "./utils";

const isValidFileExtension = (
  extension: string | undefined,
): extension is AcceptedFileExtension => {
  return AcceptedFileExtensions.includes(extension as AcceptedFileExtension);
};

const getFileExtension = (
  filePath: string,
): Result.Result<AcceptedFileExtension, InvalidFileExtensionError> => {
  const extension = filePath.split(".").pop();

  if (!extension) {
    return Result.fail(new InvalidFileExtensionError("undefined"));
  }

  if (!isValidFileExtension(extension)) {
    return Result.fail(new InvalidFileExtensionError(extension));
  }

  return Result.succeed(extension);
};

const openFileDialog = Result.try({
  try: () => open({ filters: AcceptedFileExtensions.map(getFilter) }),
  catch: (e) => new FileProcessorError("Failed to open file dialog", e),
});

const readFile = Result.try({
  try: (filePath: string) => readTextFile(filePath),
  catch: (e) => new FileReadError(e),
});

export const importFromFile = () =>
  Result.pipe(
    openFileDialog(),
    Result.andThen((path) => (path ? Result.succeed(path) : Result.fail(new NoFilePathError()))),
    Result.andThen((path) => Result.collect([getFileExtension(path), readFile(path)])),
    Result.andThen(([extension, data]) => getParser(extension)(data)),
  );
