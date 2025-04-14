import Papa from "papaparse";
import { AcceptedFileExtension, FileData } from "./types";
import { FileProcessorError } from "./error";
import { Result } from "neverthrow";

const formatJson = Result.fromThrowable(
  (data: FileData) => JSON.stringify(data, null, 2),
  (e) => new FileProcessorError("Failed to format JSON", e)
);

const formatCsv = Result.fromThrowable(
  (data: FileData) => {
    if (Array.isArray(data)) {
      return Papa.unparse(data);
    }

    if (data && typeof data === "object") {
      if (!Array.isArray(data)) {
        return Papa.unparse([data]);
      }
    }

    return Papa.unparse([{ value: String(data) }]);
  },
  (e) => new FileProcessorError("Failed to format CSV", e)
);

const formatter: Record<
  AcceptedFileExtension,
  (data: FileData) => Result<string, FileProcessorError>
> = {
  json: formatJson,
  csv: formatCsv,
};

export const getFormatter = (
  extension: AcceptedFileExtension
): ((data: FileData) => Result<string, FileProcessorError>) =>
  formatter[extension];
