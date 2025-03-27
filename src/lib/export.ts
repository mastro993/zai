import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

type ExportDataOptions = {
  data: any;
  defaultPath: string;
  format?: "json" | "csv";
};

const filters = {
  json: { name: "JSON", extensions: ["json"] },
  csv: { name: "CSV", extensions: ["csv"] },
};

const formatter = {
  json: (data: any) => JSON.stringify(data, null, 2),
  csv: (data: any) => {
    if (Array.isArray(data)) {
      if (data.length === 0) return "";

      // Get all possible headers from all items
      const headers = Array.from(
        new Set(data.flatMap((item) => Object.keys(item)))
      );
      const headerRow = headers.join(",");

      // Create data rows
      const dataRows = data.map((item) =>
        headers
          .map((header) => {
            const value = item[header];
            // Handle values that might contain commas or quotes
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? ""; // Handle undefined/null values
          })
          .join(",")
      );

      return [headerRow, ...dataRows].join("\n");
    }

    if (typeof data === "object" && data !== null) {
      const entries = Object.entries(data);
      if (entries.length === 0) return "";

      const headers = entries.map(([key]) => key);
      const values = entries.map(([_, value]) => {
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });

      return [headers.join(","), values.join(",")].join("\n");
    }

    return "";
  },
};

export const exportDataToFile = async ({
  data,
  defaultPath,
  format = "json",
}: ExportDataOptions): Promise<boolean> => {
  try {
    const filePath = await save({
      defaultPath,
      filters: [filters[format]],
      canCreateDirectories: true,
    });

    if (!filePath) {
      return false;
    }

    const formattedData = formatter[format](data);
    await writeTextFile(filePath, formattedData);

    return true;
  } catch (error) {
    return false;
  }
};
