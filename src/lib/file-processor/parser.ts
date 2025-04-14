import Papa from "papaparse";
import { ParseError } from "./error";
import { AcceptedFileExtension, ParsedData } from "./types";
import { ok, err, Result } from "neverthrow";

const parseJson = (jsonString: string): Result<ParsedData, ParseError> => {
  try {
    return ok(JSON.parse(jsonString));
  } catch (e: unknown) {
    return err(new ParseError(e));
  }
};

const parseCsv = (csvString: string): Result<ParsedData, ParseError> => {
  try {
    return ok(
      Papa.parse(csvString, { header: true, skipEmptyLines: true }).data
    );
  } catch (e: unknown) {
    return err(new ParseError(e));
  }
};

const parser: Record<
  AcceptedFileExtension,
  (data: string) => Result<ParsedData, ParseError>
> = {
  json: parseJson,
  csv: parseCsv,
};

export const getParser = (
  extension: AcceptedFileExtension
): ((data: string) => Result<ParsedData, ParseError>) => parser[extension];
