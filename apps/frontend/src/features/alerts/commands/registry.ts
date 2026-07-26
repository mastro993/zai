import { z } from "zod";

import { createCommandDescriptor, type CommandDescriptor } from "@/commands/command-descriptor";

import { domainAlertListPageSchema, domainAlertSchema } from "../types/domain-alert";
import {
  buildGetUnreadAlertCountRequest,
  buildListAlertsRequest,
  buildMarkAlertReadRequest,
  buildMarkAlertUnreadRequest,
  buildMarkAllAlertsReadRequest,
} from "./web-requests";

const countSchema = z.number();

const backendCommand = <TArgs, T>(
  name: string,
  resultSchema: z.ZodType<T>,
  webRequest: Parameters<typeof createCommandDescriptor<TArgs, T>>[2],
): CommandDescriptor<TArgs, T> => createCommandDescriptor(name, resultSchema, webRequest);

export const ALERT_COMMANDS = {
  list_alerts: backendCommand("list_alerts", domainAlertListPageSchema, buildListAlertsRequest),
  get_unread_alert_count: backendCommand(
    "get_unread_alert_count",
    countSchema,
    buildGetUnreadAlertCountRequest,
  ),
  mark_all_alerts_read: backendCommand(
    "mark_all_alerts_read",
    countSchema,
    buildMarkAllAlertsReadRequest,
  ),
  mark_alert_read: backendCommand("mark_alert_read", domainAlertSchema, buildMarkAlertReadRequest),
  mark_alert_unread: backendCommand(
    "mark_alert_unread",
    domainAlertSchema,
    buildMarkAlertUnreadRequest,
  ),
} as const;

export const ALERT_BACKEND_COMMANDS = Object.values(
  ALERT_COMMANDS,
) as unknown as Array<CommandDescriptor>;

export const ALERT_COMMAND_REGISTRY = [...ALERT_BACKEND_COMMANDS] as const;
