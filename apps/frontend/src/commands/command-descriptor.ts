import type { Result } from "@praha/byethrow";
import type { z } from "zod";

import type { CommandError } from "./errors";
import type { WebRequestSpec } from "./web-request-spec";

export type WebRequestBuilder<TArgs> = (args: TArgs) => Result.Result<WebRequestSpec, CommandError>;

export interface CommandDescriptor<TArgs = void, TResult = unknown> {
  readonly name: string;
  readonly resultSchema: z.ZodType<TResult> | "void";
  readonly webRequest: WebRequestBuilder<TArgs>;
}

export function createCommandDescriptor<TArgs, TResult>(
  name: string,
  resultSchema: z.ZodType<TResult>,
  webRequest: WebRequestBuilder<TArgs>,
): CommandDescriptor<TArgs, TResult>;

export function createCommandDescriptor<TArgs>(
  name: string,
  resultSchema: "void",
  webRequest: WebRequestBuilder<TArgs>,
): CommandDescriptor<TArgs, void>;

export function createCommandDescriptor<TArgs, TResult>(
  name: string,
  resultSchema: z.ZodType<TResult> | "void",
  webRequest: WebRequestBuilder<TArgs>,
): CommandDescriptor<TArgs, TResult> {
  return { name, resultSchema, webRequest };
}
