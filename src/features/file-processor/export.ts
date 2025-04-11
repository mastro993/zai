import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { Effect, pipe } from "effect";
import { FileProcessorError, FileWriteError, NoFilePathError } from "./error";
import { getFormatter } from "./formatter";
import { AcceptedFileExtension, FileData } from "./types";
import { getFilter } from "./utils";

export type ExportOptions = {
  data: FileData;
  extension: AcceptedFileExtension;
  fileName: string;
};

export const exportToFile = ({ data, extension, fileName }: ExportOptions) => {
  if (!data) {
    return Effect.fail(new FileProcessorError("No data provided"));
  }

  const formattedDate = dayjs().format("YYYY-MM-DDT-HH-mm-ss");
  const defaultPath = `${fileName}_${formattedDate}.${extension}`;
  const format = getFormatter(extension);

  return pipe(
    Effect.tryPromise({
      try: () =>
        save({
          defaultPath,
          filters: [getFilter(extension)],
          canCreateDirectories: true,
        }),
      catch: (error) =>
        new FileProcessorError("Failed to open save dialog", error),
    }),
    Effect.flatMap((filePath) =>
      filePath ? Effect.succeed(filePath) : Effect.fail(new NoFilePathError())
    ),
    Effect.flatMap((filePath) =>
      Effect.tryPromise({
        try: () => writeTextFile(filePath, format(data)),
        catch: (error) => new FileWriteError(error),
      })
    )
  );
};
