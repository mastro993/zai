import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Result } from "@praha/byethrow";
import { FileProcessorError, FileWriteError, NoFilePathError } from "./error";
import { getFormatter } from "./formatter";
import { AcceptedFileExtension } from "./types";
import { getFilter } from "./utils";
import { formatDate } from "date-fns";

export type ExportOptions = {
  data: unknown;
  extension: AcceptedFileExtension;
  fileName: string;
};

const openSaveDialog = Result.try({
  try: (defaultPath: string, extension: AcceptedFileExtension) =>
    save({
      defaultPath,
      filters: [getFilter(extension)],
      canCreateDirectories: true,
    }),
  catch: (e) => new FileProcessorError("Failed to open save dialog", e),
});

const writeToFile = Result.try({
  try: (filePath: string, data: string) => writeTextFile(filePath, data),
  catch: (e) => new FileWriteError(e),
});

export const exportToFile = ({
  data,
  extension,
  fileName,
}: ExportOptions): Result.ResultAsync<
  void,
  FileProcessorError | NoFilePathError | FileWriteError
> => {
  const formattedDate = formatDate(new Date(), "yyyy-MM-dd-HH-mm-ss");
  const defaultPath = `${fileName}_${formattedDate}.${extension}`;

  const format = getFormatter(extension);

  return Result.pipe(
    openSaveDialog(defaultPath, extension),
    Result.andThen((path) =>
      path ? Result.succeed(path) : Result.fail(new NoFilePathError())
    ),
    Result.andThen((path) =>
      Result.pipe(
        format(data),
        Result.andThen((formattedData) => writeToFile(path, formattedData))
      )
    )
  );
};
