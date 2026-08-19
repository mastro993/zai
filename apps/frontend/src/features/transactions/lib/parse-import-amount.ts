import { MAX_TRANSACTION_AMOUNT_MINOR } from "./transaction";

const CURRENCY_AND_SPACE_PATTERN = /[€$£¥₹\s]/g;

const normalizeLocalizedAmount = (value: string, fractionDigits: number): string | null => {
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const commaCount = (value.match(/,/g) ?? []).length;
    const fractionalPart = value.slice(lastComma + 1);

    normalized =
      commaCount === 1 && fractionalPart.length <= Math.max(fractionDigits, 1)
        ? value.replace(",", ".")
        : value.replace(/,/g, "");
  } else if (lastDot !== -1) {
    const dotCount = (value.match(/\./g) ?? []).length;
    const fractionalPart = value.slice(lastDot + 1);

    normalized =
      dotCount === 1 && fractionalPart.length <= Math.max(fractionDigits, 1)
        ? value
        : value.replace(/\./g, "");
  } else {
    normalized = value;
  }

  const amountPattern =
    fractionDigits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${fractionDigits}})?$`);
  if (!amountPattern.test(normalized)) {
    return null;
  }

  return normalized;
};

export const parseImportAmount = (
  raw: string,
  fractionDigits = 2,
): { ok: true; cents: number; signed: number } | { ok: false; message: string } => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, message: "Amount is required" };
  }

  const compact = trimmed.replace(CURRENCY_AND_SPACE_PATTERN, "");
  const hasOpeningParenthesis = compact.startsWith("(");
  const hasClosingParenthesis = compact.endsWith(")");
  if (hasOpeningParenthesis !== hasClosingParenthesis) {
    return { ok: false, message: "Invalid amount" };
  }

  const unwrapped = compact.replace(/^\(/, "").replace(/\)$/, "");
  const isNegative = unwrapped.startsWith("-") || hasOpeningParenthesis;
  const stripped = unwrapped.replace(/^[-+]/, "");

  const normalized = normalizeLocalizedAmount(stripped, fractionDigits);

  if (normalized === null) {
    return { ok: false, message: "Invalid amount" };
  }

  const absoluteValue = Number(normalized);

  if (!Number.isFinite(absoluteValue) || absoluteValue < 0) {
    return { ok: false, message: "Amount must be non-negative" };
  }

  const signed = isNegative ? -absoluteValue : absoluteValue;
  const cents = Math.round(Math.abs(signed) * 10 ** fractionDigits);

  if (!Number.isSafeInteger(cents) || cents > MAX_TRANSACTION_AMOUNT_MINOR) {
    return { ok: false, message: "Amount exceeds supported maximum" };
  }

  return {
    ok: true,
    cents,
    signed,
  };
};
