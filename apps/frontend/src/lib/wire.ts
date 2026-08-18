import { z } from "zod";

export type WireObject = { readonly [key: string]: WireValue };
export type WireValue = string | number | boolean | null | ReadonlyArray<WireValue> | WireObject;

export const wireValueSchema: z.ZodType<WireValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(wireValueSchema),
    z.record(z.string(), wireValueSchema),
  ]),
);

export const wireObjectSchema: z.ZodType<WireObject> = z.record(z.string(), wireValueSchema);

export const asWireString = <TRaw>(value: TRaw): string | undefined => {
  const parsed = z.string().safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const asWireNumber = <TRaw>(value: TRaw): number | undefined => {
  const parsed = z.number().safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const asWireBoolean = <TRaw>(value: TRaw): boolean | undefined => {
  const parsed = z.boolean().safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const asWireObject = <TRaw>(value: TRaw): WireObject | undefined => {
  if (value === null || value === undefined || Array.isArray(value)) {
    return undefined;
  }
  const parsed = wireObjectSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const asWireArray = <TRaw>(value: TRaw): ReadonlyArray<WireValue> | undefined => {
  const parsed = z.array(wireValueSchema).safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const isCallable = <TRaw>(value: TRaw): boolean => {
  const tag = Object.prototype.toString.call(value);
  return (
    tag === "[object Function]" ||
    tag === "[object AsyncFunction]" ||
    tag === "[object GeneratorFunction]"
  );
};
