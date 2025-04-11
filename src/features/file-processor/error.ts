// Custom error types
export class FileProcessorError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "FileProcessorError";
    if (cause) {
      this.cause = cause;
    }
  }
}

export class InvalidFileExtensionError extends FileProcessorError {
  constructor(extension: string) {
    super(`Invalid file extension: ${extension}`);
    this.name = "InvalidFileExtensionError";
  }
}

export class NoFilePathError extends FileProcessorError {
  constructor() {
    super("No file path provided");
    this.name = "NoFilePathError";
  }
}

export class FileReadError extends FileProcessorError {
  constructor(cause?: unknown) {
    super("Failed to read file", cause);
    this.name = "FileReadError";
  }
}

export class FileWriteError extends FileProcessorError {
  constructor(cause?: unknown) {
    super("Failed to write file", cause);
    this.name = "FileWriteError";
  }
}

export class ParseError extends FileProcessorError {
  constructor(cause?: unknown) {
    super("Failed to parse file", cause);
    this.name = "ParseError";
  }
}
