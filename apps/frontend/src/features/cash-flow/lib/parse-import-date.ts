import type { TransactionImportDateFormat } from "./transaction-import-types";

const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const DATE_FORMAT_PATTERNS: Record<
  Exclude<TransactionImportDateFormat, "ISO">,
  {
    pattern: RegExp;
    order: ["year", "month", "day"] | ["day", "month", "year"] | ["month", "day", "year"];
  }
> = {
  "YYYY-MM-DD": { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ["year", "month", "day"] },
  "DD/MM/YYYY": { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ["day", "month", "year"] },
  "MM/DD/YYYY": { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ["month", "day", "year"] },
  "DD-MM-YYYY": { pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: ["day", "month", "year"] },
  "DD.MM.YYYY": { pattern: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, order: ["day", "month", "year"] },
};

const padDatePart = (value: string) => value.padStart(2, "0");

const isLeapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number) => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return 31;
};

const isValidCalendarDate = (year: number, month: number, day: number) => {
  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > daysInMonth(year, month)) {
    return false;
  }

  return true;
};

const isValidTime = (hour: number, minute: number, second: number) =>
  hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;

const parseNumericPart = (value: string) => Number.parseInt(value, 10);

export const parseImportDate = (
  raw: string,
  format: TransactionImportDateFormat,
): { ok: true; value: string } | { ok: false; message: string } => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, message: "Date is required" };
  }

  if (format === "ISO") {
    const match = trimmed.match(ISO_DATETIME_PATTERN);

    if (!match) {
      return { ok: false, message: "Date must match ISO datetime (YYYY-MM-DDTHH:mm:ss)" };
    }

    const [, year, month, day, hour, minute, second = "00"] = match;
    const yearNumber = parseNumericPart(year);
    const monthNumber = parseNumericPart(month);
    const dayNumber = parseNumericPart(day);
    const hourNumber = parseNumericPart(hour);
    const minuteNumber = parseNumericPart(minute);
    const secondNumber = parseNumericPart(second);

    if (
      !isValidCalendarDate(yearNumber, monthNumber, dayNumber) ||
      !isValidTime(hourNumber, minuteNumber, secondNumber)
    ) {
      return { ok: false, message: "Invalid date" };
    }

    const isoDate = `${year}-${month}-${day}`;
    const isoDateTime = `${isoDate}T${hour}:${minute}:${second}`;

    return { ok: true, value: isoDateTime };
  }

  const { pattern, order } = DATE_FORMAT_PATTERNS[format];
  const match = trimmed.match(pattern);

  if (!match) {
    return { ok: false, message: `Date must match ${format}` };
  }

  const parts = { year: "", month: "", day: "" };

  if (order[0] === "year") {
    [, parts.year, parts.month, parts.day] = match;
  } else if (order[0] === "day") {
    [, parts.day, parts.month, parts.year] = match;
  } else {
    [, parts.month, parts.day, parts.year] = match;
  }

  const yearNumber = parseNumericPart(parts.year);
  const monthNumber = parseNumericPart(parts.month);
  const dayNumber = parseNumericPart(parts.day);

  if (!isValidCalendarDate(yearNumber, monthNumber, dayNumber)) {
    return { ok: false, message: "Invalid date" };
  }

  const isoDate = `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;

  return { ok: true, value: `${isoDate}T00:00:00` };
};
