import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { err, ok, okAsync, Result, ResultAsync } from "neverthrow";
import {
  FileProcessorError,
  FileReadError,
  InvalidFileExtensionError,
  NoFilePathError,
} from "./error";
import { getParser } from "./parser";
import { AcceptedFileExtension, AcceptedFileExtensions } from "./types";
import { getFilter } from "./utils";

const isValidFileExtension = (
  extension: string | undefined
): extension is AcceptedFileExtension => {
  return AcceptedFileExtensions.includes(extension as AcceptedFileExtension);
};

const getFileExtension = (
  filePath: string
): Result<AcceptedFileExtension, InvalidFileExtensionError> => {
  const extension = filePath.split(".").pop();

  if (!extension) {
    return err(new InvalidFileExtensionError("undefined"));
  }

  if (!isValidFileExtension(extension)) {
    return err(new InvalidFileExtensionError(extension));
  }

  return ok(extension);
};

const openFileDialog = ResultAsync.fromThrowable(
  () => open({ filters: AcceptedFileExtensions.map(getFilter) }),
  (e) => new FileProcessorError("Failed to open file dialog", e)
);

const readFile = ResultAsync.fromThrowable(
  (filePath: string) => readTextFile(filePath),
  (e) => new FileReadError(e)
);

export const importFromFile = () =>
  openFileDialog()
    .andThen((path) => (path ? ok(path) : err(new NoFilePathError())))
    .andThen((path) => {
      const parser = getFileExtension(path)
        .asyncAndThen((_) => okAsync(_))
        .map(getParser);
      const data = readFile(path);

      return ResultAsync.combine([parser, data]);
    })
    .map(([parser, data]) => parser(data));
