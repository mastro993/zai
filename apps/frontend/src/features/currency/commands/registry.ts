import { createCommandDescriptor } from "@/commands/command-descriptor";

import {
  currencyBootstrapSchema,
  currencyJobSchema,
  currencySettingsRowSchema,
  currencyStatusViewSchema,
  exchangeRateQuoteSchema,
  supportedCurrencySchema,
} from "../types/currency";
import {
  buildCancelCurrencyJobRequest,
  buildCompleteInitialCurrencySetupRequest,
  buildDisableCurrencyRequest,
  buildGetCurrenciesRequest,
  buildGetCurrencyBootstrapRequest,
  buildGetCurrencyJobRequest,
  buildGetCurrencyRequest,
  buildGetCurrencyStatusRequest,
  buildGetSupportedCurrenciesRequest,
  buildGetTransactionExchangeRateQuoteRequest,
  buildRetryExchangeRateRefreshRequest,
  buildStartCurrencyAdditionRequest,
  buildStartDefaultCurrencyChangeRequest,
} from "./web-requests";

export const CURRENCY_COMMANDS = {
  get_currency_bootstrap: createCommandDescriptor(
    "get_currency_bootstrap",
    currencyBootstrapSchema,
    buildGetCurrencyBootstrapRequest,
  ),
  get_currencies: createCommandDescriptor(
    "get_currencies",
    currencySettingsRowSchema.array(),
    buildGetCurrenciesRequest,
  ),
  get_supported_currencies: createCommandDescriptor(
    "get_supported_currencies",
    supportedCurrencySchema.array(),
    buildGetSupportedCurrenciesRequest,
  ),
  get_currency: createCommandDescriptor(
    "get_currency",
    currencySettingsRowSchema,
    buildGetCurrencyRequest,
  ),
  complete_initial_currency_setup: createCommandDescriptor(
    "complete_initial_currency_setup",
    currencyJobSchema,
    buildCompleteInitialCurrencySetupRequest,
  ),
  get_currency_job: createCommandDescriptor(
    "get_currency_job",
    currencyJobSchema,
    buildGetCurrencyJobRequest,
  ),
  get_currency_status: createCommandDescriptor(
    "get_currency_status",
    currencyStatusViewSchema,
    buildGetCurrencyStatusRequest,
  ),
  start_currency_addition: createCommandDescriptor(
    "start_currency_addition",
    currencyJobSchema,
    buildStartCurrencyAdditionRequest,
  ),
  disable_currency: createCommandDescriptor(
    "disable_currency",
    currencySettingsRowSchema,
    buildDisableCurrencyRequest,
  ),
  start_default_currency_change: createCommandDescriptor(
    "start_default_currency_change",
    currencyJobSchema,
    buildStartDefaultCurrencyChangeRequest,
  ),
  cancel_currency_job: createCommandDescriptor(
    "cancel_currency_job",
    currencyJobSchema,
    buildCancelCurrencyJobRequest,
  ),
  get_transaction_exchange_rate_quote: createCommandDescriptor(
    "get_transaction_exchange_rate_quote",
    exchangeRateQuoteSchema,
    buildGetTransactionExchangeRateQuoteRequest,
  ),
  retry_exchange_rate_refresh: createCommandDescriptor(
    "retry_exchange_rate_refresh",
    "void",
    buildRetryExchangeRateRefreshRequest,
  ),
};

export const CURRENCY_BACKEND_COMMANDS = Object.values(CURRENCY_COMMANDS);
