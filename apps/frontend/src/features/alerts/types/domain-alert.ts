import { z } from "zod";

export const DOMAIN_ALERT_SEVERITIES = ["info", "warning", "critical"] as const;

const domainAlertDestinationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("budget"),
    budgetId: z.string().uuid(),
  }),
]);

const domainAlertRichDataSchema = z.object({
  kind: z.string().min(1),
  version: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
});

export const domainAlertSchema = z.object({
  id: z.string().uuid(),
  producerKey: z.string().min(1),
  occurrenceKey: z.string().min(1),
  severity: z.enum(DOMAIN_ALERT_SEVERITIES),
  title: z.string().min(1),
  body: z.string().min(1),
  destination: domainAlertDestinationSchema.nullable().optional(),
  data: domainAlertRichDataSchema.nullable().optional(),
  createdAt: z.string().min(1),
  readAt: z.string().nullable().optional(),
});

export const domainAlertListPageSchema = z.object({
  items: z.array(domainAlertSchema),
  nextCursor: z.string().nullable().optional(),
});

export type DomainAlertSeverity = (typeof DOMAIN_ALERT_SEVERITIES)[number];
export type DomainAlertDestination = z.infer<typeof domainAlertDestinationSchema>;
export type DomainAlertRichData = z.infer<typeof domainAlertRichDataSchema>;
export type DomainAlert = z.infer<typeof domainAlertSchema>;
export type DomainAlertListPage = z.infer<typeof domainAlertListPageSchema>;
