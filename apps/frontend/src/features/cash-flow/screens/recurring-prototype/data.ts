export type RecurringLifecycle = "active" | "paused" | "stopped" | "completed";

export type CountMode = "finite" | "indefinite";

export interface LinkedTransaction {
  id: string;
  label: string;
  amountMinor: number;
  occurredOn: string;
  direction: "source" | "generated" | "adopted";
}

export interface BudgetImpactRow {
  budgetName: string;
  periodLabel: string;
  kind: "historical" | "projected";
  amountMinor: number;
}

export interface RecurringPrototype {
  id: string;
  name: string;
  templateDescription: string;
  amountMinor: number;
  currency: string;
  categoryPath: string;
  lifecycle: RecurringLifecycle;
  countMode: CountMode;
  fulfilled: number;
  total: number | null;
  ruleLabel: string;
  zone: string;
  nextOccurrenceOn: string | null;
  linkedTransactions: Array<LinkedTransaction>;
  budgetImpact: Array<BudgetImpactRow>;
}

export interface OrphanTransaction {
  id: string;
  label: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
}

export const PROTOTYPE_RECURRING: Array<RecurringPrototype> = [
  {
    id: "rt-rent",
    name: "Apartment rent",
    templateDescription: "Monthly rent — Via Roma",
    amountMinor: -145000,
    currency: "EUR",
    categoryPath: "Housing / Rent",
    lifecycle: "active",
    countMode: "finite",
    fulfilled: 8,
    total: 12,
    ruleLabel: "Every month on day 1 · 09:00",
    zone: "Europe/Rome",
    nextOccurrenceOn: "2026-08-01",
    linkedTransactions: [
      {
        id: "tx-rent-01",
        label: "Apartment rent",
        amountMinor: -145000,
        occurredOn: "2026-01-01",
        direction: "adopted",
      },
      {
        id: "tx-rent-08",
        label: "Apartment rent",
        amountMinor: -145000,
        occurredOn: "2026-07-01",
        direction: "generated",
      },
    ],
    budgetImpact: [
      {
        budgetName: "Housing",
        periodLabel: "Jul 2026",
        kind: "historical",
        amountMinor: -145000,
      },
      {
        budgetName: "Housing",
        periodLabel: "Aug 2026",
        kind: "projected",
        amountMinor: -145000,
      },
      {
        budgetName: "Housing",
        periodLabel: "Sep 2026",
        kind: "projected",
        amountMinor: -145000,
      },
    ],
  },
  {
    id: "rt-salary",
    name: "Payroll",
    templateDescription: "Monthly salary",
    amountMinor: 320000,
    currency: "EUR",
    categoryPath: "Income / Salary",
    lifecycle: "active",
    countMode: "indefinite",
    fulfilled: 19,
    total: null,
    ruleLabel: "Every month on day 27 · 08:00",
    zone: "Europe/Rome",
    nextOccurrenceOn: "2026-07-27",
    linkedTransactions: [
      {
        id: "tx-sal-19",
        label: "Payroll",
        amountMinor: 320000,
        occurredOn: "2026-06-27",
        direction: "generated",
      },
    ],
    budgetImpact: [
      {
        budgetName: "Net cash flow",
        periodLabel: "Jun 2026",
        kind: "historical",
        amountMinor: 320000,
      },
      {
        budgetName: "Net cash flow",
        periodLabel: "Jul 2026",
        kind: "projected",
        amountMinor: 320000,
      },
    ],
  },
  {
    id: "rt-gym",
    name: "Gym membership",
    templateDescription: "Fitness club",
    amountMinor: -4999,
    currency: "EUR",
    categoryPath: "Health / Fitness",
    lifecycle: "paused",
    countMode: "indefinite",
    fulfilled: 6,
    total: null,
    ruleLabel: "Every month on day 15 · 10:00",
    zone: "Europe/Rome",
    nextOccurrenceOn: null,
    linkedTransactions: [
      {
        id: "tx-gym-06",
        label: "Gym membership",
        amountMinor: -4999,
        occurredOn: "2026-03-15",
        direction: "generated",
      },
    ],
    budgetImpact: [
      {
        budgetName: "Lifestyle",
        periodLabel: "Mar 2026",
        kind: "historical",
        amountMinor: -4999,
      },
    ],
  },
  {
    id: "rt-netflix",
    name: "Streaming (old)",
    templateDescription: "Netflix",
    amountMinor: -1599,
    currency: "EUR",
    categoryPath: "Entertainment / Streaming",
    lifecycle: "stopped",
    countMode: "indefinite",
    fulfilled: 14,
    total: null,
    ruleLabel: "Every month on day 8 · 12:00",
    zone: "Europe/Rome",
    nextOccurrenceOn: null,
    linkedTransactions: [
      {
        id: "tx-nf-14",
        label: "Streaming (old)",
        amountMinor: -1599,
        occurredOn: "2026-02-08",
        direction: "generated",
      },
    ],
    budgetImpact: [
      {
        budgetName: "Lifestyle",
        periodLabel: "Feb 2026",
        kind: "historical",
        amountMinor: -1599,
      },
    ],
  },
  {
    id: "rt-laptop",
    name: "Laptop installments",
    templateDescription: "Laptop — installment",
    amountMinor: -9999,
    currency: "EUR",
    categoryPath: "Shopping / Electronics",
    lifecycle: "completed",
    countMode: "finite",
    fulfilled: 12,
    total: 12,
    ruleLabel: "Every month on day 3 · 18:00",
    zone: "Europe/Rome",
    nextOccurrenceOn: null,
    linkedTransactions: [
      {
        id: "tx-lap-12",
        label: "Laptop installments",
        amountMinor: -9999,
        occurredOn: "2026-04-03",
        direction: "generated",
      },
    ],
    budgetImpact: [
      {
        budgetName: "Shopping",
        periodLabel: "Apr 2026",
        kind: "historical",
        amountMinor: -9999,
      },
    ],
  },
];

export const ORPHAN_TRANSACTIONS: Array<OrphanTransaction> = [
  {
    id: "tx-orphan-1",
    label: "Old VPN plan",
    amountMinor: -999,
    occurredOn: "2025-11-01",
    note: "Source recurring was tombstoned — no indicator, no link.",
  },
];

export const ADOPTABLE_TRANSACTIONS = [
  {
    id: "tx-adopt-1",
    label: "Car insurance annual",
    amountMinor: -62000,
    occurredOn: "2026-06-10",
  },
  { id: "tx-adopt-2", label: "Cloud storage", amountMinor: -299, occurredOn: "2026-07-12" },
] as const;
