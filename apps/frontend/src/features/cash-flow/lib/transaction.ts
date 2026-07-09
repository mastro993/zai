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

const partialAmountInputPattern = /^\d*[.,]?\d{0,2}$/;
const completeAmountPattern = /^\d+(\.\d{1,2})?$/;

export const formatAmountFromMinor = (minorUnits: number) => {
  return (minorUnits / 100).toFixed(2);
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

export const normalizeAmountInput = (value: string) => {
  const prepared = prepareAmountForValidation(value);

  if (!prepared) {
    return value.trim();
  }

  if (!completeAmountPattern.test(prepared)) {
    return value;
  }

  const parsed = Number(prepared);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return value;
  }

  return parsed.toFixed(2);
};

export const isPartialAmountInput = (value: string) => {
  return partialAmountInputPattern.test(value);
};
