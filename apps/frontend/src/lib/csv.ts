const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r\n＝＋－＠]/u;

export const escapeCsvValue = (value: string) => {
  const needsFormulaProtection = SPREADSHEET_FORMULA_PREFIX.test(value);
  const protectedValue = needsFormulaProtection ? `\t${value}` : value;
  const escaped = protectedValue.replaceAll('"', '""');

  return needsFormulaProtection || /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

export const parseCsv = (content: string): Array<Array<string>> => {
  const rows: Array<Array<string>> = [[]];
  let value = "";
  let isQuoted = false;

  const pushValue = () => {
    rows[rows.length - 1].push(value);
    value = "";
  };

  const pushRow = () => {
    pushValue();
    rows.push([]);
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (isQuoted) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          isQuoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"' && value === "") {
      isQuoted = true;
    } else if (char === ",") {
      pushValue();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      pushRow();
      if (content[index + 1] === "\n") {
        index += 1;
      }
    } else {
      value += char;
    }
  }

  pushValue();

  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  return rows;
};
