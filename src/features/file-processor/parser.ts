import { Effect } from "effect";
import Papa from "papaparse";
import { ParseError } from "./error";
import { AcceptedFileExtension, ParsedData } from "./types";

const parseJson = (
  data: string
): Effect.Effect<ParsedData, ParseError, never> =>
  Effect.try({
    try: () => JSON.parse(data),
    catch: (error) => new ParseError(error),
  });

const parseCsv = (data: string): Effect.Effect<ParsedData, ParseError, never> =>
  Effect.try({
    try: () => Papa.parse(data, { header: true, skipEmptyLines: true }).data,
    catch: (error) => new ParseError(error),
  });

const parser: Record<
  AcceptedFileExtension,
  (data: string) => Effect.Effect<ParsedData, ParseError, never>
> = {
  json: parseJson,
  csv: parseCsv,
};

export const getParser = (
  extension: AcceptedFileExtension
): ((data: string) => Effect.Effect<ParsedData, ParseError, never>) =>
  parser[extension];
