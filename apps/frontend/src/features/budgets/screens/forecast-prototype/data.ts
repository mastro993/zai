// PROTOTYPE stub — wipe with branch. Answers #176 forecast surface question.

export type ForecastStatus = "on_track" | "warning" | "overspent" | null;

export interface SourceAttribution {
  recurringId: string;
  recurringName: string;
  occurrenceOn: string;
  amountMinor: number;
}

export interface SourceError {
  recurringId: string;
  recurringName: string;
  code: "catch_up_backlog" | "parked_source" | "revision_gap";
  message: string;
}

export interface PeriodForecast {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  partial: boolean;
  coverageThrough: string | null;
  actualSpendingMinor: number;
  projectedDeltaMinor: number;
  forecastSpendingMinor: number;
  forecastRemainingMinor: number | null;
  forecastStatus: ForecastStatus;
  attributions: Array<SourceAttribution>;
}

export interface BudgetForecast {
  id: string;
  name: string;
  cadence: "monthly" | "weekly";
  paused: boolean;
  zone: string;
  allowanceMinor: number;
  currentActualSpendingMinor: number;
  currentRemainingMinor: number;
  currentStatus: Exclude<ForecastStatus, null>;
  periods: Array<PeriodForecast>;
}

export const AS_OF = "2026-07-20T10:00:00Z";
export const CURRENCY = "EUR";
export const MAX_HORIZON_MONTHS = 12;

export const SOURCE_ERRORS: Array<SourceError> = [
  {
    recurringId: "rt-insurance",
    recurringName: "Car insurance",
    code: "catch_up_backlog",
    message: "Catch-up unfinished — contribution withheld",
  },
];

export const BUDGET_FORECASTS: Array<BudgetForecast> = [
  {
    id: "b-housing",
    name: "Housing",
    cadence: "monthly",
    paused: false,
    zone: "Europe/Rome",
    allowanceMinor: 160000,
    currentActualSpendingMinor: 145000,
    currentRemainingMinor: 15000,
    currentStatus: "on_track",
    periods: [
      period(
        "Jul 2026",
        "2026-07-01",
        "2026-08-01",
        false,
        null,
        145000,
        0,
        145000,
        15000,
        "on_track",
        [attr("rt-rent", "Apartment rent", "2026-07-01", -145000)],
      ),
      period(
        "Aug 2026",
        "2026-08-01",
        "2026-09-01",
        false,
        null,
        0,
        -145000,
        -145000,
        15000,
        "on_track",
        [attr("rt-rent", "Apartment rent", "2026-08-01", -145000)],
      ),
      period(
        "Sep 2026",
        "2026-09-01",
        "2026-10-01",
        false,
        null,
        0,
        -145000,
        -145000,
        15000,
        "on_track",
        [attr("rt-rent", "Apartment rent", "2026-09-01", -145000)],
      ),
      period(
        "Oct 2026",
        "2026-10-01",
        "2026-11-01",
        false,
        null,
        0,
        -145000,
        -145000,
        15000,
        "on_track",
        [attr("rt-rent", "Apartment rent", "2026-10-01", -145000)],
      ),
      period(
        "Nov 2026",
        "2026-11-01",
        "2026-12-01",
        false,
        null,
        0,
        -145000,
        -145000,
        15000,
        "on_track",
        [attr("rt-rent", "Apartment rent", "2026-11-01", -145000)],
      ),
      period(
        "Dec 2026",
        "2026-12-01",
        "2027-01-01",
        false,
        null,
        0,
        -145000,
        -145000,
        15000,
        "on_track",
        [attr("rt-rent", "Apartment rent", "2026-12-01", -145000)],
      ),
      period(
        "Jan 2027",
        "2027-01-01",
        "2027-02-01",
        true,
        "2027-01-20",
        0,
        -145000,
        -145000,
        null,
        null,
        [attr("rt-rent", "Apartment rent", "2027-01-01", -145000)],
      ),
    ],
  },
  {
    id: "b-groceries",
    name: "Groceries",
    cadence: "monthly",
    paused: false,
    zone: "Europe/Rome",
    allowanceMinor: 45000,
    currentActualSpendingMinor: 18200,
    currentRemainingMinor: 26800,
    currentStatus: "on_track",
    periods: [
      period(
        "Jul 2026",
        "2026-07-01",
        "2026-08-01",
        false,
        null,
        18200,
        -8000,
        26200,
        18800,
        "on_track",
        [
          attr("rt-box", "Weekly produce box", "2026-07-22", -4000),
          attr("rt-box", "Weekly produce box", "2026-07-29", -4000),
        ],
      ),
      period(
        "Aug 2026",
        "2026-08-01",
        "2026-09-01",
        false,
        null,
        0,
        -16000,
        -16000,
        29000,
        "on_track",
        [
          attr("rt-box", "Weekly produce box", "2026-08-05", -4000),
          attr("rt-box", "Weekly produce box", "2026-08-12", -4000),
          attr("rt-box", "Weekly produce box", "2026-08-19", -4000),
          attr("rt-box", "Weekly produce box", "2026-08-26", -4000),
        ],
      ),
      period(
        "Sep 2026",
        "2026-09-01",
        "2026-10-01",
        false,
        null,
        0,
        -16000,
        -16000,
        29000,
        "on_track",
        [
          attr("rt-box", "Weekly produce box", "2026-09-02", -4000),
          attr("rt-box", "Weekly produce box", "2026-09-09", -4000),
          attr("rt-box", "Weekly produce box", "2026-09-16", -4000),
          attr("rt-box", "Weekly produce box", "2026-09-23", -4000),
        ],
      ),
      period(
        "Oct 2026",
        "2026-10-01",
        "2026-11-01",
        false,
        null,
        0,
        -20000,
        -20000,
        25000,
        "warning",
        [
          attr("rt-box", "Weekly produce box", "2026-10-07", -4000),
          attr("rt-box", "Weekly produce box", "2026-10-14", -4000),
          attr("rt-box", "Weekly produce box", "2026-10-21", -4000),
          attr("rt-box", "Weekly produce box", "2026-10-28", -4000),
          attr("rt-delivery", "Meal kit", "2026-10-15", -4000),
        ],
      ),
      period(
        "Nov 2026",
        "2026-11-01",
        "2026-12-01",
        false,
        null,
        0,
        -16000,
        -16000,
        29000,
        "on_track",
        [
          attr("rt-box", "Weekly produce box", "2026-11-04", -4000),
          attr("rt-box", "Weekly produce box", "2026-11-11", -4000),
          attr("rt-box", "Weekly produce box", "2026-11-18", -4000),
          attr("rt-box", "Weekly produce box", "2026-11-25", -4000),
        ],
      ),
      period(
        "Dec 2026",
        "2026-12-01",
        "2027-01-01",
        false,
        null,
        0,
        -16000,
        -16000,
        29000,
        "on_track",
        [
          attr("rt-box", "Weekly produce box", "2026-12-02", -4000),
          attr("rt-box", "Weekly produce box", "2026-12-09", -4000),
          attr("rt-box", "Weekly produce box", "2026-12-16", -4000),
          attr("rt-box", "Weekly produce box", "2026-12-23", -4000),
        ],
      ),
      period(
        "Jan 2027",
        "2027-01-01",
        "2027-02-01",
        true,
        "2027-01-20",
        0,
        -8000,
        -8000,
        null,
        null,
        [
          attr("rt-box", "Weekly produce box", "2027-01-06", -4000),
          attr("rt-box", "Weekly produce box", "2027-01-13", -4000),
        ],
      ),
    ],
  },
  {
    id: "b-transport",
    name: "Transport",
    cadence: "monthly",
    paused: false,
    zone: "Europe/Rome",
    allowanceMinor: 12000,
    currentActualSpendingMinor: 3500,
    currentRemainingMinor: 8500,
    currentStatus: "on_track",
    periods: [
      period("Jul 2026", "2026-07-01", "2026-08-01", false, null, 3500, 0, 3500, 8500, null, []),
      period("Aug 2026", "2026-08-01", "2026-09-01", false, null, 0, 0, 0, 12000, null, []),
      period("Sep 2026", "2026-09-01", "2026-10-01", false, null, 0, 0, 0, 12000, null, []),
      period("Oct 2026", "2026-10-01", "2026-11-01", false, null, 0, 0, 0, 12000, null, []),
      period("Nov 2026", "2026-11-01", "2026-12-01", false, null, 0, 0, 0, 12000, null, []),
      period("Dec 2026", "2026-12-01", "2027-01-01", false, null, 0, 0, 0, 12000, null, []),
      period("Jan 2027", "2027-01-01", "2027-02-01", true, "2027-01-20", 0, 0, 0, null, null, []),
    ],
  },
  {
    id: "b-dining",
    name: "Dining out",
    cadence: "monthly",
    paused: true,
    zone: "Europe/Rome",
    allowanceMinor: 20000,
    currentActualSpendingMinor: 0,
    currentRemainingMinor: 20000,
    currentStatus: "on_track",
    periods: [
      period("Jul 2026", "2026-07-01", "2026-08-01", false, null, 0, 0, 0, 20000, null, []),
      period("Aug 2026", "2026-08-01", "2026-09-01", false, null, 0, -6000, -6000, 14000, null, [
        attr("rt-date-night", "Date night fund", "2026-08-14", -6000),
      ]),
      period("Sep 2026", "2026-09-01", "2026-10-01", false, null, 0, -6000, -6000, 14000, null, [
        attr("rt-date-night", "Date night fund", "2026-09-14", -6000),
      ]),
      period("Oct 2026", "2026-10-01", "2026-11-01", false, null, 0, -6000, -6000, 14000, null, [
        attr("rt-date-night", "Date night fund", "2026-10-14", -6000),
      ]),
      period("Nov 2026", "2026-11-01", "2026-12-01", false, null, 0, -6000, -6000, 14000, null, [
        attr("rt-date-night", "Date night fund", "2026-11-14", -6000),
      ]),
      period("Dec 2026", "2026-12-01", "2027-01-01", false, null, 0, -6000, -6000, 14000, null, [
        attr("rt-date-night", "Date night fund", "2026-12-14", -6000),
      ]),
      period("Jan 2027", "2027-01-01", "2027-02-01", true, "2027-01-20", 0, 0, 0, null, null, []),
    ],
  },
];

function attr(
  recurringId: string,
  recurringName: string,
  occurrenceOn: string,
  amountMinor: number,
): SourceAttribution {
  return { recurringId, recurringName, occurrenceOn, amountMinor };
}

function period(
  periodLabel: string,
  periodStart: string,
  periodEnd: string,
  partial: boolean,
  coverageThrough: string | null,
  actualSpendingMinor: number,
  projectedDeltaMinor: number,
  forecastSpendingMinor: number,
  forecastRemainingMinor: number | null,
  forecastStatus: ForecastStatus,
  attributions: Array<SourceAttribution>,
): PeriodForecast {
  return {
    periodLabel,
    periodStart,
    periodEnd,
    partial,
    coverageThrough,
    actualSpendingMinor,
    projectedDeltaMinor,
    forecastSpendingMinor,
    forecastRemainingMinor,
    forecastStatus,
    attributions,
  };
}

export function slicePeriods(budget: BudgetForecast, horizonMonths: number): Array<PeriodForecast> {
  return budget.periods.slice(0, Math.max(1, Math.min(horizonMonths, MAX_HORIZON_MONTHS)));
}

export function aggregateProjectedDelta(budget: BudgetForecast, horizonMonths: number): number {
  return slicePeriods(budget, horizonMonths).reduce((sum, p) => sum + p.projectedDeltaMinor, 0);
}
