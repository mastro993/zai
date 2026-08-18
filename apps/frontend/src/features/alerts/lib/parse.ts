import { asWireNumber, asWireObject, asWireString } from "@/lib/wire";

import {
  domainAlertListPageSchema,
  domainAlertSchema,
  type DomainAlert,
  type DomainAlertListPage,
  type DomainAlertRichData,
} from "../types/domain-alert";
import { parseDomainAlertEvent as parseEvent } from "../types/domain-alert-event";

export const parseDomainAlert = <TRaw>(value: TRaw): DomainAlert | null => {
  const parsed = domainAlertSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseDomainAlertListPage = <TRaw>(value: TRaw): DomainAlertListPage | null => {
  const parsed = domainAlertListPageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseDomainAlertEvent = parseEvent;

export const isUnreadAlert = (alert: DomainAlert): boolean => !alert.readAt && !alert.resolvedAt;

export const isNavigableAlertDestination = (
  destination: DomainAlert["destination"],
): destination is NonNullable<DomainAlert["destination"]> =>
  destination?.type === "budget" || destination?.type === "currencySettings";

export const parseAlertRichData = <TRaw>(value: TRaw): DomainAlertRichData | null => {
  const record = asWireObject(value);
  if (!record) {
    return null;
  }
  const kind = asWireString(record.kind);
  const version = asWireNumber(record.version);
  const payload = asWireObject(record.payload);
  if (kind === undefined || kind.trim().length === 0) {
    return null;
  }
  if (version === undefined || !Number.isInteger(version) || version <= 0) {
    return null;
  }
  if (!payload) {
    return null;
  }
  return {
    kind,
    version,
    payload: { ...payload },
  };
};
