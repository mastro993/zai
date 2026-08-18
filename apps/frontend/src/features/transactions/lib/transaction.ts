export const toBackendDateTime = (value: string) => {
  return value.length === 16 ? `${value}:00` : value;
};

export const toDateTimeInputValue = (value: string) => {
  return value.slice(0, 16);
};

export const splitDateTime = (value: string) => {
  const normalized = toDateTimeInputValue(value);
  const [date = "", time = "00:00"] = normalized.split("T");

  return {
    date,
    time: time.slice(0, 5) || "00:00",
  };
};

export const combineDateTime = (date: string, time: string) => {
  const normalizedTime = time.length >= 5 ? time.slice(0, 5) : "00:00";

  return `${date}T${normalizedTime}`;
};

export const MAX_TRANSACTION_AMOUNT_MINOR = 2_147_483_647;

const amountPattern = (fractionDigits: number) => {
  if (fractionDigits === 0) {
    return /^\d+$/;
  }

  return new RegExp(`^\\d+(\\.\\d{1,${fractionDigits}})?$`);
};

const partialAmountPattern = (fractionDigits: number) => {
  if (fractionDigits === 0) {
    return /^\d*$/;
  }

  return new RegExp(`^\\d*[.,]?\\d{0,${fractionDigits}}$`);
};

export const formatAmountFromMinor = (minorUnits: number, fractionDigits = 2) => {
  return (minorUnits / 10 ** fractionDigits).toFixed(fractionDigits);
};

export const prepareAmountForValidation = (value: string) => {
  const trimmed = value.trim().replace(",", ".");

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith(".")) {
    return `0${trimmed}`;
  }

  return trimmed;
};

export interface AmountParseSuccess {
  ok: true;
  minor: number;
}

export interface AmountParseFailure {
  ok: false;
  message: string;
}

export const parseAmountToMinor = (
  value: string,
  fractionDigits: number,
): AmountParseSuccess | AmountParseFailure => {
  const prepared = prepareAmountForValidation(value);

  if (!prepared) {
    return { ok: false, message: "Amount is required" };
  }

  if (!amountPattern(fractionDigits).test(prepared)) {
    return { ok: false, message: "Enter a valid amount" };
  }

  const parsed = Number(prepared);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, message: "Amount must be zero or greater" };
  }

  const minor = Math.round(parsed * 10 ** fractionDigits);

  if (!Number.isSafeInteger(minor) || minor > MAX_TRANSACTION_AMOUNT_MINOR) {
    return { ok: false, message: "Amount exceeds supported maximum" };
  }

  return { ok: true, minor };
};

export const normalizeAmountInput = (value: string, fractionDigits = 2) => {
  const parsed = parseAmountToMinor(value, fractionDigits);

  if (!parsed.ok) {
    return value;
  }

  return formatAmountFromMinor(parsed.minor, fractionDigits);
};

export const isPartialAmountInput = (value: string, fractionDigits = 2) => {
  return partialAmountPattern(fractionDigits).test(value);
};
