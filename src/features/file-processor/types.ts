export const AcceptedFileExtensions = ["json", "csv"] as const;
export type AcceptedFileExtension = (typeof AcceptedFileExtensions)[number];

export type FileData = unknown;
export type ParsedData = unknown;
