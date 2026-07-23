import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RecurringFeedFilters } from "../types/recurring-transaction";

export function RecurringFeedFiltersBar({
  filters,
  disabled,
  onChange,
}: {
  filters: RecurringFeedFilters;
  disabled: boolean;
  onChange: (filters: RecurringFeedFilters) => void;
}) {
  const search = filters.search ?? "";
  const hasFilters = Boolean(search || filters.lifecycle || filters.needsAttention !== undefined);

  return (
    <div className="flex flex-wrap items-end gap-2" aria-label="Recurring transaction filters">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Description
        <Input
          value={search}
          maxLength={200}
          disabled={disabled}
          placeholder="Search descriptions"
          onChange={(event) => onChange({ ...filters, search: event.target.value || undefined })}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Lifecycle
        <Select
          value={filters.lifecycle ?? "all"}
          disabled={disabled}
          onValueChange={(value) =>
            onChange({
              ...filters,
              lifecycle:
                value === "all"
                  ? undefined
                  : (value as NonNullable<RecurringFeedFilters["lifecycle"]>),
            })
          }
        >
          <SelectTrigger aria-label="Filter by lifecycle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lifecycles</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Attention
        <Select
          value={
            filters.needsAttention === undefined
              ? "all"
              : filters.needsAttention
                ? "needsAttention"
                : "clear"
          }
          disabled={disabled}
          onValueChange={(value) =>
            onChange({
              ...filters,
              needsAttention: value === "all" ? undefined : value !== "clear",
            })
          }
        >
          <SelectTrigger aria-label="Filter by attention">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All attention states</SelectItem>
            <SelectItem value="needsAttention">Needs attention</SelectItem>
            <SelectItem value="clear">No attention needed</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange({})}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
