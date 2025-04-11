import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Effect, pipe } from "effect";
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
): Effect.Effect<AcceptedFileExtension, InvalidFileExtensionError, never> =>
  pipe(
    Effect.succeed(filePath.split(".").pop()),
    Effect.flatMap((extension) =>
      isValidFileExtension(extension)
        ? Effect.succeed(extension)
        : Effect.fail(new InvalidFileExtensionError(extension ?? "undefined"))
    )
  );

export const importFromFile = () =>
  pipe(
    Effect.tryPromise({
      try: () =>
        open({
          filters: AcceptedFileExtensions.map(getFilter),
        }),
      catch: (error) =>
        new FileProcessorError("Failed to open file dialog", error),
    }),
    Effect.flatMap((filePath) =>
      filePath ? Effect.succeed(filePath) : Effect.fail(new NoFilePathError())
    ),
    Effect.flatMap((filePath) =>
      pipe(
        Effect.tryPromise({
          try: () => readTextFile(filePath),
          catch: (error) => new FileReadError(error),
        }),
        Effect.flatMap((data) =>
          pipe(
            getFileExtension(filePath),
            Effect.map((extension) => ({ data, extension }))
          )
        )
      )
    ),
    Effect.flatMap(({ data, extension }) => getParser(extension)(data)),
    Effect.catchAll((error) => Effect.fail(error))
  );
