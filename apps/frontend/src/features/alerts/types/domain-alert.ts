import { z } from "zod";

export const DOMAIN_ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export const DOMAIN_ALERT_READ_STATES = ["all", "read", "unread"] as const;

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

export const domainAlertReadStateSchema = z.enum(DOMAIN_ALERT_READ_STATES);

export const listDomainAlertsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  readState: domainAlertReadStateSchema.optional(),
  severities: z.array(z.enum(DOMAIN_ALERT_SEVERITIES)).min(1).optional(),
});

export type DomainAlertSeverity = (typeof DOMAIN_ALERT_SEVERITIES)[number];
export type DomainAlertReadState = z.infer<typeof domainAlertReadStateSchema>;
export type ListDomainAlertsQuery = z.infer<typeof listDomainAlertsQuerySchema>;
export type DomainAlertDestination = z.infer<typeof domainAlertDestinationSchema>;
export type DomainAlertRichData = z.infer<typeof domainAlertRichDataSchema>;
export type DomainAlert = z.infer<typeof domainAlertSchema>;
export type DomainAlertListPage = z.infer<typeof domainAlertListPageSchema>;
