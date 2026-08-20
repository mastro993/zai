import { Result } from "@praha/byethrow";
import { useEffect, useState } from "react";
import { useWatch, type Control, type UseFormRegister } from "react-hook-form";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getTransactionExchangeRateQuote } from "@/features/currency/commands/currency";
import type { ExchangeRateQuote } from "@/features/currency/types/currency";
import { formatCurrencyFromMinor, isoFractionDigits } from "@/lib/currency";

import { parseAmountToMinor, prepareAmountForValidation } from "../lib/transaction";
import {
  convertedMinorFromRate,
  formatConversionRatePlaceholder,
  quoteDateFromInput,
} from "../lib/transaction-write";
import type { Transaction, TransactionFormInput, TransactionFormValues } from "../types/model";

export function useTransactionConversion({
  control,
  defaultCurrency,
  lockedRate,
  lockedCurrency,
  lockedDate,
}: {
  control: Control<TransactionFormInput, unknown, TransactionFormValues>;
  defaultCurrency: string;
  lockedRate: Transaction["exchangeRate"] | null;
  lockedCurrency: string | null;
  lockedDate: string | null;
}) {
  const amount = useWatch({ control, name: "amount" }) ?? "";
  const currency = useWatch({ control, name: "currency" }) ?? defaultCurrency;
  const transactionDate = useWatch({ control, name: "transactionDate" }) ?? "";
  const manualExchangeRate = useWatch({ control, name: "manualExchangeRate" }) ?? "";
  const [quote, setQuote] = useState<ExchangeRateQuote | null>(null);
  const date = quoteDateFromInput(transactionDate);
  const showRateField = currency !== defaultCurrency;
  const usesLockedRate =
    Boolean(lockedRate) &&
    lockedCurrency === currency &&
    lockedDate === date &&
    !manualExchangeRate.trim() &&
    (lockedRate?.variant === "pending" || Boolean(lockedRate?.originalDecimal));

  useEffect(() => {
    if (!showRateField || usesLockedRate) {
      setQuote(null);
      return;
    }

    if (!date) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getTransactionExchangeRateQuote(currency, defaultCurrency, date).then((result) => {
        if (!cancelled && Result.isSuccess(result)) {
          setQuote(result.value);
        }
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currency, date, defaultCurrency, showRateField, usesLockedRate]);

  const parsed = parseAmountToMinor(amount, isoFractionDigits(currency));
  const lockedDecimal = usesLockedRate ? (lockedRate?.originalDecimal ?? null) : null;
  const pendingLocked = usesLockedRate && lockedRate?.variant === "pending";
  const dateRate = lockedDecimal || quote?.rate;
  const dateRateDate = usesLockedRate ? (lockedRate?.rateDate ?? date) : (quote?.rateDate ?? date);
  const typedRate = prepareAmountForValidation(manualExchangeRate);
  const rate = typedRate || dateRate;

  let convertedDescription: string | null = null;
  let convertedPending = false;
  if (currency !== defaultCurrency) {
    if (!parsed.ok || pendingLocked || !rate) {
      convertedPending = true;
    } else {
      const converted = convertedMinorFromRate(parsed.minor, currency, defaultCurrency, rate);
      if (converted === null) {
        convertedPending = true;
      } else {
        convertedDescription = formatCurrencyFromMinor(converted, defaultCurrency);
      }
    }
  }

  const placeholder =
    showRateField && dateRate && dateRateDate
      ? formatConversionRatePlaceholder(currency, defaultCurrency, dateRate, dateRateDate)
      : "";

  return {
    convertedDescription,
    convertedPending,
    placeholder,
    showRateField,
  };
}

export function ConvertedAmountDescription({
  pending,
  text,
}: {
  pending: boolean;
  text: string | null;
}) {
  if (!pending && !text) {
    return null;
  }

  if (pending) {
    return (
      <FieldDescription className="flex items-center gap-1.5">
        Converted amount:
        <span
          data-slot="skeleton"
          aria-busy="true"
          className="inline-block h-[1em] w-[6em] shrink-0 animate-pulse rounded-sm bg-muted"
        />
      </FieldDescription>
    );
  }

  return (
    <FieldDescription className="tabular-nums">{`Converted amount: ${text}`}</FieldDescription>
  );
}

export function ConversionRateField({
  placeholder,
  register,
}: {
  placeholder: string;
  register: UseFormRegister<TransactionFormInput>;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="transaction-conversion-rate">Conversion rate</FieldLabel>
      <Input
        id="transaction-conversion-rate"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className="tabular-nums"
        {...register("manualExchangeRate")}
      />
    </Field>
  );
}
