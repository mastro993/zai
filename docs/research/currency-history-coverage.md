# Currency metadata and complete historical coverage

Research date: 2026-08-14  
Wayfinder ticket: [Define supported-currency metadata and complete historical coverage](https://github.com/mastro993/zai/issues/370)

## Decision recommendation

Use a versioned, generated currency manifest. Do not use a library runtime list or a
rate provider's currency list as the currency authority.

Use these rules:

1. Use the current [SIX ISO 4217 List One XML](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml)
   for current alphabetic codes, numeric codes, names, and ISO minor-unit digits.
   SIX is the ISO 4217 Maintenance Agency.
2. Remove all [List Two fund codes](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-two.doc)
   and the explicit non-fiat codes in this report. List One is a list of currencies,
   funds, and precious metals. It is not a fiat-only list.
3. Use a pinned stable CLDR release for regional tender intervals and transition time
   zones. Use CLDR as supporting metadata, not as the authority for current ISO
   status or ISO minor-unit digits.
4. Give each rate provider a versioned adapter contract. The contract must define
   its base currency, quote direction, value-date time zone, publication calendar,
   publication deadline, revision window, and known coverage start for each code.
5. Enable a currency only after a staging process proves complete coverage from the
   user's coverage start through the latest rate that is due. Commit the currency and
   its rate history in one local database transaction. A failed gate must make no
   currency available.
6. Carry the last rate forward only across a day on which the provider was not due to
   publish. A missing rate on an expected publication day is a gap. Fail closed for a
   gap. Do not interpolate, use a later rate, use an unlimited stale rate, or silently
   change providers.

This design is reliable and private. The remote request needs only currency codes and
date ranges. It must never contain amounts, descriptions, categories, notes, or other
user financial data.

## Source hierarchy

| Need | Authority | Zai rule |
| --- | --- | --- |
| Current ISO code, numeric code, name, minor-unit digits | [SIX ISO 4217 Maintenance Agency](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html) List One | Pin the publication date and file digest. Generate one row per unique alphabetic code. |
| Fund-code exclusion | SIX List Two | Exclude every code in List Two. |
| Withdrawn ISO code and withdrawal month or date | [SIX List Three XML](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-three.xml) and [SIX amendments](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html) | A withdrawn code is not available for new Zai use. Keep existing records and cached rates unchanged. |
| Regional tender interval and transition time zone | [Unicode CLDR 48.2 supplemental currency data](https://github.com/unicode-org/cldr/blob/release-48-2/common/supplemental/supplementalData.xml) and the [versioned LDML specification](https://www.unicode.org/reports/tr35/tr35-78/tr35-numbers.html#Supplemental_Currency_Data) | Use it to propose inception and withdrawal boundaries. Confirm a disputed or material boundary with the issuing central bank or law before enablement. |
| Rate value, value date, calendar, publication time, revision, cessation | Official provider data and methodology | The adapter must preserve the provider facts. It must not infer a publication on a missing expected day. |

The hierarchy is necessary because the sources answer different questions. ISO says
that a code is current or historical. CLDR describes regional usage intervals. A rate
provider says whether it published a usable market observation for a code and date.
None of these facts proves the other facts.

## Current active ISO fiat-code candidates

The SIX file available on the research date has publication date `2026-01-01`. It has
178 unique alphabetic codes. The following deterministic exclusions leave 155 fiat
currency-code candidates:

- List Two fund codes: `BOV`, `CHE`, `CHW`, `CLF`, `COU`, `MXV`, `USN`, `UYI`,
  `UYW`, and `XAD`.
- Precious metals: `XAG`, `XAU`, `XPD`, and `XPT`.
- Bond-market units: `XBA`, `XBB`, `XBC`, and `XBD`.
- International accounting units: `XDR`, `XSU`, and `XUA`.
- Test and no-currency codes: `XTS` and `XXX`.

The candidate codes are:

```text
AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD
BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP
ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS
INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR
LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN
NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD
SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY
TTD TWD TZS UAH UGX USD UYU UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER
ZAR ZMW ZWG
```

This is a metadata candidate set. It is not an enablement list. For example, an active
ISO code can have no complete rate series. Two current ISO codes can also describe a
transition or parallel use. Each candidate must pass the history gate below.

Do not filter all codes that start with `X`. `XAF`, `XCD`, `XCG`, `XOF`, and `XPF`
are fiat currencies in the candidate set. Use the explicit exclusions instead.

## Minor units and amount precision

ISO states that ISO 4217 includes the relationship between a currency and its minor
unit. List One supplies this as `CcyMnrUnts`. Use this value for persisted money and
input validation.

CLDR `digits` is for normal formatting. The [LDML specification](https://www.unicode.org/reports/tr35/tr35-78/tr35-numbers.html#Supplemental_Currency_Data)
says that it is based on ISO minor units but can differ when customary practice gives
a reason. CLDR also has separate cash digits and cash rounding. These display and cash
facts must not change the meaning of a stored amount.

Therefore:

- Store the ISO minor-unit digits with the versioned currency metadata.
- Reject a candidate if the ISO minor-unit field is absent or `N.A.`.
- Do not assume two digits. Current fiat candidates include zero-digit and three-digit
  currencies.
- Do not let `Intl.NumberFormat`, ICU, CLDR, or a provider choose persistence
  precision at runtime.
- A later metadata update must never reinterpret old integer amounts. A minor-unit
  change needs an explicit migration or a new-code transition.

## Inception, withdrawal, and redenomination

The SIX current and historical lists identify code status. The historical list often
gives only a withdrawal month. SIX amendments can give an exact effective date and a
fixed conversion rule. For example, the current SIX page records the Bulgarian euro
change, its parallel-circulation interval, and the fixed `EUR 1 = BGN 1.95583` rule.

CLDR supplies `from`, `to`, `tz`, `to-tz`, and `tender` fields. It also warns that its
history is limited because ISO 4217 does not cover all old currencies. CLDR can overlap
old and new currency intervals during a transition. A versioned CLDR release is stable,
but the data is not a legal or rate-coverage guarantee.

Use these rules:

- Define one `valid_from` and optional `valid_to` policy for each enabled code. Keep
  the evidence URL and metadata version.
- Use the issuing authority or law when SIX and CLDR do not give one clear exact
  boundary.
- Reject a transaction date outside the currency's approved interval.
- Treat a redenomination as two currency identities when ISO issues a new code. Do not
  apply the new code's rates to the old code.
- Do not make a synthetic market rate before a new currency's inception. An official
  fixed redenomination ratio is a transition fact, not a market observation.
- When a current code is withdrawn, block new use after the approved end boundary.
  Keep existing transaction snapshots and local rate provenance. Never rewrite old
  values because the current list changed.

The map excludes obsolete currencies. Zai can keep old data for integrity, but it must
not offer a withdrawn code for new transactions unless a later product decision adds
obsolete-currency support.

## Coverage interval

Define the **coverage start** as the earliest local calendar date of any retained
actual monetary record that Zai can include in history, calculations, export, or
recovery. This is a data date. It is not the import time, account-creation time, or
application-install time. If there is no such record, use the current local date.

For currency `C`, its first required date is:

```text
max(user coverage start, approved inception date of C)
```

If the default currency did not exist on the user coverage start, the default currency
also uses this rule. A record cannot use a currency before its approved inception date.

Define the **latest due date** from the provider calendar and publication deadline. It
is the latest value date for which the provider should already have published a rate.
A current provider business day before its deadline is `not_yet_due`; it is not a gap.
A future date is not historical coverage.

Complete coverage means that every calendar date from the first required date through
the present has one deterministic state:

- exact published observation;
- approved carry-forward from an earlier observation on a declared non-publication
  date;
- current-day `not_yet_due`; or
- gap.

Only the first three states are complete. Enablement fails if any date is a gap.

## Weekends, holidays, and missing publications

There is no universal foreign-exchange publication calendar. Use the calendar owned by
the selected provider. Do not use the device locale's weekend or holiday rules.

The ECB example shows why this is necessary. Its [exchange-rate page](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)
says that it normally publishes around 16:00 CET on each working day except TARGET
closing days. Its [methodology](https://www.ecb.europa.eu/stats/pdf/exchange/Frameworkfortheeuroforeignexchangereferencerates.en.pdf)
says that it publishes in principle on TARGET operating days. It can also stop one
currency when market data is not representative. The ECB stopped its RUB series after
1 March 2022 even though RUB remained an ISO currency.

Use this gap policy:

1. On an exact observation date, use that observation.
2. On a provider-declared non-publication date, use the nearest earlier observation.
   Store both the requested value date and the source observation date.
3. Never carry backward from a later observation. If no earlier observation exists at
   the coverage boundary, coverage is incomplete.
4. On a date when publication was due, a missing observation is a gap after the
   provider deadline and retry policy finish.
5. A provider suspension or cessation is a gap, not a long holiday. Keep the currency
   unavailable for initial enablement. For an already enabled currency, preserve all
   stable actual snapshots and expose a coverage failure for new automatic valuations.
6. Do not fill a gap with interpolation or an undeclared second provider. A provider
   change needs an explicit provenance boundary and a new validation run.

This policy gives values for weekend transactions without hiding missing market data.

## Rate date and time semantics

A daily rate date is not a midnight market price and not the transaction time. Store
separate facts:

- `value_date`: the provider's daily label in its declared time zone;
- `observed_at` or fixing time, if the provider gives it;
- `published_at`, if the provider gives it;
- `acquired_at`: when Zai received it;
- `source_observation_date`: the original date when carry-forward is used;
- provider, series identifier, base currency, quote currency, original decimal text,
  and source revision or digest.

The ECB states that its rates reflect market conditions around 14:10 CET and are
published around 16:00 CET. It also says that the rates are for information and that
use for transactions is strongly discouraged. Zai must present them as reference
valuations, not as an executable exchange quote or a bank conversion result.

For a historical transaction on local calendar date `D`, select the provider value date
`D`. The provider fixing time only controls when that observation becomes available.
Do not select a different rate from the transaction's clock time. If `D` is a current
publication day and the final rate is not due, keep the automatic actual valuation
pending or require the ratified manual-rate path.

The ECB can amend a rate until it publishes the same currency on the next business day.
The adapter must refresh this mutable tail. It must mark a source observation final only
after the provider revision window closes. Stable transaction rate snapshots must not
change when the shared source cache later receives a revision.

## Cross-rate mathematics

Normalize one provider dataset to this quote:

```text
R[C, D] = units of currency C for one unit of provider base B on value date D
R[B, D] = 1
```

For an amount in currency `X` converted to currency `Y` on the same date:

```text
amount_Y = amount_X * R[Y, D] / R[X, D]
```

This follows from the units. For example, the ECB page states that all listed currencies
are quoted against the euro base currency.

Use these implementation rules:

- Both legs must have the same provider, dataset, value date, base, and finality state.
- Parse and keep the provider decimal text. Use checked decimal or rational arithmetic,
  not binary floating-point arithmetic.
- Do not round either rate leg or a derived pair rate. Round the converted money once,
  at the target currency's ISO minor unit. Use one documented decimal rounding rule;
  round-half-even is the recommendation.
- Store both source legs and the formula version with the transaction snapshot. Do not
  store only an unexplained derived number.
- Test identity, reciprocal, and triangle invariants within the exact provider decimal
  precision. A base-to-base conversion must be exactly one.

## Validation gate before enablement

The gate must pass all checks below before Zai enables a currency.

### Metadata checks

- The manifest records the SIX publication date, CLDR stable version, source URLs, and
  SHA-256 digests.
- The code is in the generated 155-code candidate set for that manifest version.
- Alphabetic code, numeric code, name, and ISO minor-unit digits are present and
  internally consistent across duplicate country rows.
- The code has an approved inception and optional withdrawal rule. Any source conflict
  has a recorded resolution from an issuing authority.
- The whole requested interval is inside the approved currency interval.

### Provider contract checks

- The adapter declares base, quote direction, decimal syntax and scale, value-date time
  zone, publication calendar, deadline, revision window, and cessation behavior.
- The provider terms permit access and local cache use for Zai's purpose.
- Requests contain only codes, date ranges, and protocol data.
- The provider identifies the code as a currency series. A name-only match is not
  sufficient.

### History checks

- Fetch into staging. Do not expose partial rows.
- Each observation has one valid date and one positive finite decimal value.
- Dates are ordered and unique. Duplicate rows with different values are an error.
- Every expected publication date through the latest due date has an observation.
- Every non-publication calendar date resolves to an earlier observation.
- The first required date has an exact or earlier source observation. It must not use a
  later observation.
- All cross-rate legs exist on the same source observation date. Cross-rate invariants
  pass with checked arithmetic.
- Refetch the provider's mutable revision tail before the final completeness check.
- A second run is idempotent and gives the same normalized history for unchanged source
  data.
- Commit the metadata version, staged rates, coverage result, and enabled state in one
  SQLite transaction. Any error leaves the currency disabled.

### Ongoing checks

- Recompute the latest due date from the provider calendar.
- Retry network failures without changing a missing expected publication into a
  non-publication day.
- Refresh the mutable tail and append new final observations.
- Mark a coverage failure when an expected rate remains missing. Do not change stable
  actual transaction snapshots.
- Review every new SIX amendment and each new stable CLDR release before replacing the
  pinned manifest. Never update metadata silently at application runtime.

## ECB as a coverage example, not a universal provider

The ECB is an official and well-documented source, but it cannot enable all active fiat
codes:

- The [ECB SDMX information](https://www.ecb.europa.eu/stats/ecb_statistics/sdmx/html/index.en.html)
  describes historical daily reference-rate data since 1999.
- The ECB methodology limits coverage to EU non-euro currencies and other currencies
  with liquid active spot markets. It does not claim all ISO fiat currencies.
- The ECB reference page records a current RUB publication suspension.
- The rates are point-in-time reference rates for information. They are not transaction
  execution rates.
- The ECB can revise a rate during a limited window and can cease a series when its data
  quality is not sufficient.

Therefore, a current metadata code, an available latest rate, and an API success are not
proof of full history. Coverage must be measured for each code and user interval.

## Access and licensing limits

- ISO 4217 standard text is protected and store access is paid. The [ISO currency-code
  page](https://www.iso.org/iso-4217-currency-codes.html) permits free use of ISO 4217
  codes and links to the public SIX lists. This report does not reproduce the ISO
  standard text. Zai should retain source and version notices and should not vendor the
  full standard.
- SIX says that it makes the maintained code lists available online and free of charge.
  The live files can change. Zai must pin the publication date and digest. Confirm the
  redistribution terms before shipping an unmodified SIX file. A generated minimal
  code manifest should contain only the fields Zai needs.
- Unicode says that its data files use the free and open-source Unicode License v3.
  Use a stable CLDR release, retain its notice, and do not build from the mutable `main`
  branch. The [CLDR downloads page](https://cldr.unicode.org/index/downloads) says that
  released versions are stable.
- The [ECB reuse policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html)
  permits free reuse of public ESCB statistics with source attribution. Modified data
  must be identified as modified. Zai must say that cross rates and carry-forward rows
  are its calculations. The policy does not promise that every series will continue.

## Final finding

The deterministic unit is not "one supported-code list." It is a versioned tuple:

```text
currency manifest version
+ approved currency validity interval
+ provider contract version
+ complete normalized observations for the user's interval
+ explicit carry-forward provenance
```

Only that tuple can prove that an enabled currency is valid and complete. ISO and CLDR
define metadata. The provider defines observations. Zai must measure the join and fail
closed when the join has a gap.
