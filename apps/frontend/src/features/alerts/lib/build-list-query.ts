import type { ListDomainAlertsQuery } from "../types/domain-alert";
import type { AlertSessionFilters } from "./session-filters";

interface BuildListQueryOptions {
  cursor?: string;
  limit?: number;
}

export const buildListAlertsQuery = (
  filters: AlertSessionFilters,
  options: BuildListQueryOptions = {},
): ListDomainAlertsQuery => {
  const query: ListDomainAlertsQuery = {};

  if (filters.readState !== "all") {
    query.readState = filters.readState;
  }
  if (filters.severity !== "all") {
    query.severities = [filters.severity];
  }
  if (options.cursor) {
    query.cursor = options.cursor;
  }
  if (options.limit !== undefined) {
    query.limit = options.limit;
  }

  return query;
};
