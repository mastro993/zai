import {
  domainAlertListPageSchema,
  domainAlertSchema,
  type DomainAlert,
  type DomainAlertListPage,
  type DomainAlertRichData,
} from "../types/domain-alert";

export const parseDomainAlert = (value: unknown): DomainAlert | null => {
  const parsed = domainAlertSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseDomainAlertListPage = (value: unknown): DomainAlertListPage | null => {
  const parsed = domainAlertListPageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const isUnreadAlert = (alert: DomainAlert): boolean => !alert.readAt;

export const parseAlertRichData = (value: unknown): DomainAlertRichData | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== "string" || record.kind.trim().length === 0) {
    return null;
  }
  if (
    typeof record.version !== "number" ||
    !Number.isInteger(record.version) ||
    record.version <= 0
  ) {
    return null;
  }
  if (!record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) {
    return null;
  }
  return {
    kind: record.kind,
    version: record.version,
    payload: record.payload as Record<string, unknown>,
  };
};
