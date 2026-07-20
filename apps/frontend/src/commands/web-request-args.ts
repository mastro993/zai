export const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
};

export const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

export const readStringArray = (value: unknown): Array<string> | undefined => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return value;
};

export const readNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" ? value : fallback;
};

export const omitId = (payload: Record<string, unknown>): Record<string, unknown> => {
  const { id: _id, ...rest } = payload;
  return rest;
};
