import Papa from "papaparse";
import { AcceptedFileExtension, FileData } from "./types";
import { FileProcessorError } from "./error";
import { Result } from "@praha/byethrow";

const formatJson = Result.try({
  try: (data: FileData) => JSON.stringify(data, null, 2),
  catch: (e) => new FileProcessorError("Failed to format JSON", e),
});

const formatCsv = Result.try({
  try: (data: FileData) => {
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
  catch: (e) => new FileProcessorError("Failed to format CSV", e),
});

const formatter: Record<
  AcceptedFileExtension,
  (data: FileData) => Result.Result<string, FileProcessorError>
> = {
  json: formatJson,
  csv: formatCsv,
};

export const getFormatter = (
  extension: AcceptedFileExtension
): ((data: FileData) => Result.Result<string, FileProcessorError>) =>
  formatter[extension];
