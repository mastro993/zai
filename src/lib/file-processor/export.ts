import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { err, ok, ResultAsync } from "neverthrow";
import { FileProcessorError, FileWriteError, NoFilePathError } from "./error";
import { getFormatter } from "./formatter";
import { AcceptedFileExtension, FileData } from "./types";
import { getFilter } from "./utils";
import { formatDate } from "date-fns";

export type ExportOptions = {
  data: FileData;
  extension: AcceptedFileExtension;
  fileName: string;
};

const openSaveDialog = ResultAsync.fromThrowable(
  (defaultPath: string, extension: AcceptedFileExtension) =>
    save({
      defaultPath,
      filters: [getFilter(extension)],
      canCreateDirectories: true,
    }),
  (e) => new FileProcessorError("Failed to open save dialog", e)
);

const writeToFile = ResultAsync.fromThrowable(
  (filePath: string, data: string) => writeTextFile(filePath, data),
  (e) => new FileWriteError(e)
);

export const exportToFile = ({
  data,
  extension,
  fileName,
}: ExportOptions): ResultAsync<
  void,
  FileProcessorError | NoFilePathError | FileWriteError
> => {
  const formattedDate = formatDate(new Date(), "yyyy-MM-ddT-HH-mm-ss");
  const defaultPath = `${fileName}_${formattedDate}.${extension}`;
  const format = getFormatter(extension);

  return format(data).asyncAndThen((data) =>
    openSaveDialog(defaultPath, extension)
      .andThen((path) => (path ? ok(path) : err(new NoFilePathError())))
      .andThen((filePath) => writeToFile(filePath, data))
  );
};
