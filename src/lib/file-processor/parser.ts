import Papa from "papaparse";
import { ParseError } from "./error";
import { AcceptedFileExtension, ParsedData } from "./types";
import { Result } from "@praha/byethrow";

const parseJson = Result.try({
  try: (jsonString: string): ParsedData => JSON.parse(jsonString),
  catch: (e) => new ParseError(e),
});

const parseCsv = Result.try({
  try: (csvString: string) => Papa.parse(csvString, { header: true, skipEmptyLines: true }).data,
  catch: (e) => new ParseError(e),
});

const parser: Record<
  AcceptedFileExtension,
  (data: string) => Result.Result<ParsedData, ParseError>
> = {
  json: parseJson,
  csv: parseCsv,
};

export const getParser = (
  extension: AcceptedFileExtension,
): ((data: string) => Result.Result<ParsedData, ParseError>) => parser[extension];
