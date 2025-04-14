import Papa from "papaparse";
import { AcceptedFileExtension, FileData } from "./types";

const formatJson = (data: FileData) => JSON.stringify(data, null, 2);

const formatCsv = (data: FileData) => {
  // Handle array data
  if (Array.isArray(data)) {
    return Papa.unparse(data);
  }

  // Handle object data
  if (data && typeof data === "object") {
    // If it's a single object, convert to array with one item
    if (!Array.isArray(data)) {
      return Papa.unparse([data]);
    }
  }

  // Fallback for other data types
  return Papa.unparse([{ value: String(data) }]);
};

const formatter: Record<AcceptedFileExtension, (data: FileData) => string> = {
  json: formatJson,
  csv: formatCsv,
};

export const getFormatter = (
  extension: AcceptedFileExtension
): ((data: FileData) => string) => formatter[extension];
