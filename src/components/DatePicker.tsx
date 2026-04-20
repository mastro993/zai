import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { DateField, DateRangePicker, RangeCalendar, Label } from "@heroui/react";
import {
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { Button } from "@heroui/react";
import { useState } from "react";
import type { DateValue, RangeValue } from "@heroui/react";

function toCalendarDate(d: Date): CalendarDate {
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export default function DatePicker() {
  const now = today(getLocalTimeZone());
  const todayDate = new Date();

  const presets = [
    { label: "Today", from: todayDate, to: todayDate },
    { label: "Yesterday", from: subDays(todayDate, 1), to: subDays(todayDate, 1) },
    { label: "Last 7 days", from: subDays(todayDate, 6), to: todayDate },
    { label: "Last 30 days", from: subDays(todayDate, 29), to: todayDate },
    { label: "Month to date", from: startOfMonth(todayDate), to: todayDate },
    {
      label: "Last month",
      from: startOfMonth(subMonths(todayDate, 1)),
      to: endOfMonth(subMonths(todayDate, 1)),
    },
    { label: "Year to date", from: startOfYear(todayDate), to: todayDate },
    {
      label: "Last year",
      from: startOfYear(subYears(todayDate, 1)),
      to: endOfYear(subYears(todayDate, 1)),
    },
  ];

  const [value, setValue] = useState<RangeValue<DateValue> | null>({
    start: toCalendarDate(presets[7].from),
    end: toCalendarDate(presets[7].to),
  });

  return (
    <DateRangePicker value={value} onChange={setValue}>
      <Label className="sr-only">Date range</Label>
      <DateField.Group>
        <DateField.InputContainer>
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover>
        <div className="flex gap-4">
          <div className="flex flex-col gap-1 py-2 pe-2 border-e">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onPress={() =>
                  setValue({
                    start: toCalendarDate(preset.from),
                    end: toCalendarDate(preset.to),
                  })
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <RangeCalendar aria-label="Choose date range">
            <RangeCalendar.Header>
              <RangeCalendar.YearPickerTrigger>
                <RangeCalendar.YearPickerTriggerHeading />
                <RangeCalendar.YearPickerTriggerIndicator />
              </RangeCalendar.YearPickerTrigger>
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>
                {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
              </RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>
                {(date) => <RangeCalendar.Cell date={date} isDisabled={date.compare(now) > 0} />}
              </RangeCalendar.GridBody>
            </RangeCalendar.Grid>
          </RangeCalendar>
        </div>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}
