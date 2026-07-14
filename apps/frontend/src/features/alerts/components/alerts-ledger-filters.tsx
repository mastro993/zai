import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { domainAlertSeverityLabel } from "../lib/format";
import type { AlertSessionFilters, AlertSeverityFilter } from "../lib/session-filters";
import type { DomainAlertReadState } from "../types/domain-alert";

const READ_STATE_OPTIONS: Array<{ value: DomainAlertReadState; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

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

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "secondary" : "outline"}
          className={cn("h-7 px-2 text-[11px]", value === option.value && "pointer-events-none")}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function AlertsLedgerFilters({
  filters,
  onReadStateChange,
  onSeverityChange,
}: AlertsLedgerFiltersProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
      <FilterGroup
        label="State"
        options={READ_STATE_OPTIONS}
        value={filters.readState}
        onChange={onReadStateChange}
      />
      <FilterGroup
        label="Severity"
        options={SEVERITY_OPTIONS}
        value={filters.severity}
        onChange={onSeverityChange}
      />
    </div>
  );
}
