export type ImportFileMetadata = {
  name: string;
  content: string;
};

export type SelectCsvImportFileOptions = {
  title: string;
};

export type DownloadTextFileOptions = {
  title: string;
  filename: string;
  content: string;
  defaultPath?: string;
};
