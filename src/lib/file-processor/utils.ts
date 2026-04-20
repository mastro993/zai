import { DialogFilter } from "@tauri-apps/plugin-dialog";
import { AcceptedFileExtension } from "./types";

export const filters: Record<AcceptedFileExtension, DialogFilter> = {
  json: { name: "JSON", extensions: ["json"] },
  csv: { name: "CSV", extensions: ["csv"] },
};

export const getFilter = (extension: AcceptedFileExtension): DialogFilter => filters[extension];
