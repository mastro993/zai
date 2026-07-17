const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r\n＝＋－＠]/u;

export const escapeCsvValue = (value: string) => {
  const needsFormulaProtection = SPREADSHEET_FORMULA_PREFIX.test(value);
  const protectedValue = needsFormulaProtection ? `\t${value}` : value;
  const escaped = protectedValue.replaceAll('"', '""');

  return needsFormulaProtection || /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
};
