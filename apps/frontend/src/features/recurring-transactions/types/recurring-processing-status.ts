import { z } from "zod";

export const RECURRING_PROCESSING_STATUSES = ["idle", "updating", "delayed"] as const;

export const recurringProcessingStatusViewSchema = z.object({
  status: z.enum(RECURRING_PROCESSING_STATUSES),
});

export type RecurringProcessingStatus = (typeof RECURRING_PROCESSING_STATUSES)[number];
export type RecurringProcessingStatusView = z.infer<typeof recurringProcessingStatusViewSchema>;
