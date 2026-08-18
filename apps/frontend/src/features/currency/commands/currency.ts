import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type {
  CurrencyBootstrap,
  CurrencyJob,
  CurrencySettingsRow,
  CurrencyStatusView,
  SupportedCurrency,
} from "../types/currency";
import { CURRENCY_COMMANDS } from "./registry";

export const getCurrencyBootstrap = (): CommandResult<CurrencyBootstrap> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.get_currency_bootstrap);
};

export const getCurrencies = (): CommandResult<CurrencySettingsRow[]> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.get_currencies);
};

export const getSupportedCurrencies = (): CommandResult<SupportedCurrency[]> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.get_supported_currencies);
};

export const getCurrency = (code: string): CommandResult<CurrencySettingsRow> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.get_currency, { code });
};

export const completeInitialCurrencySetup = (
  defaultCurrency: string,
): CommandResult<CurrencyJob> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.complete_initial_currency_setup, {
    defaultCurrency,
  });
};

export const getCurrencyJob = (jobId: string): CommandResult<CurrencyJob> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.get_currency_job, { jobId });
};

export const getCurrencyStatus = (): CommandResult<CurrencyStatusView> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.get_currency_status);
};
