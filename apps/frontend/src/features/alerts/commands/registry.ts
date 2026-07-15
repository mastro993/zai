import { z } from "zod";

import type { CommandDescriptor } from "@/commands/command-descriptor";

import { domainAlertListPageSchema, domainAlertSchema } from "../types/domain-alert";

const countSchema = z.number();

const backendCommand = <T>(
  name: string,
  resultSchema: CommandDescriptor<T>["resultSchema"],
): CommandDescriptor<T> => ({
  name,
  transport: "backend",
  resultSchema,
  webMapped: true,
});

export const ALERT_COMMANDS = {
  list_alerts: backendCommand("list_alerts", domainAlertListPageSchema),
  get_unread_alert_count: backendCommand("get_unread_alert_count", countSchema),
  mark_all_alerts_read: backendCommand("mark_all_alerts_read", countSchema),
  mark_alert_read: backendCommand("mark_alert_read", domainAlertSchema),
  mark_alert_unread: backendCommand("mark_alert_unread", domainAlertSchema),
} as const;

export const ALERT_BACKEND_COMMANDS = Object.values(ALERT_COMMANDS) as Array<CommandDescriptor>;

export const ALERT_COMMAND_REGISTRY = [...ALERT_BACKEND_COMMANDS] as const;
