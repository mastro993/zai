import { FilterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { domainAlertSeverityLabel } from "../lib/format";
import {
  isDefaultAlertSessionFilters,
  type AlertSessionFilters,
  type AlertSeverityFilter,
} from "../lib/session-filters";
import type { DomainAlertReadState } from "../types/domain-alert";

const SEVERITY_OPTIONS: Array<{ value: AlertSeverityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "info", label: domainAlertSeverityLabel("info") },
  { value: "warning", label: domainAlertSeverityLabel("warning") },
  { value: "critical", label: domainAlertSeverityLabel("critical") },
];

interface AlertsLedgerFiltersProps {
  filters: AlertSessionFilters;
  onReadStateChange: (readState: DomainAlertReadState) => void;
  onSeverityChange: (severity: AlertSeverityFilter) => void;
}

export function AlertsLedgerFilters({
  filters,
  onReadStateChange,
  onSeverityChange,
}: AlertsLedgerFiltersProps) {
  const filtersApplied = !isDefaultAlertSessionFilters(filters);
  const showRead = filters.readState !== "unread";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={filtersApplied ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={
              filtersApplied ? "Filter notifications, filters applied" : "Filter notifications"
            }
          />
        }
      >
        <HugeiconsIcon icon={FilterIcon} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" side="bottom">
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={showRead}
            onCheckedChange={(checked) => onReadStateChange(checked ? "all" : "unread")}
          >
            Read
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Severity</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.severity}
            onValueChange={(value) => {
              const option = SEVERITY_OPTIONS.find((candidate) => candidate.value === value);
              if (option) {
                onSeverityChange(option.value);
              }
            }}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
