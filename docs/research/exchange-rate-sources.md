# Exchange-rate sources for production

Research date: 2026-08-14

Related ticket: [Choose privacy-safe live and historical exchange-rate
sources](https://github.com/mastro993/zai/issues/369)

## Decision

Use the European Central Bank (ECB) as the only approved automatic
exchange-rate source for the first production implementation.

This decision has one hard limit. Zai can automatically support only EUR and a
currency that passes all these checks:

1. The ECB publishes that currency for the full date range that Zai needs.
2. The ECB still publishes a current rate for that currency.
3. The rules from [Define supported-currency metadata and complete historical
   coverage](https://github.com/mastro993/zai/issues/370) can fill every required
   date without an ambiguous result.

Do not use the default Frankfurter blend in production. Do not use a commercial
API key in the distributed Zai application. Do not silently use a different
provider when the ECB is not available.

This is a no-go decision for automatic support of all active ISO 4217 fiat
currencies. No evaluated source gives Zai all of these properties at the same
time:

- full current and historical coverage;
- clear commercial and permanent local-storage rights;
- no secret in the distributed application;
- no user financial data in a request;
- a production availability contract.

If the product requires automatic rates for currencies outside the approved ECB
set, Zai must first do one of these actions:

- buy a commercial contract that explicitly permits a distributed desktop
  application and permanent local rate snapshots, and design a safe credential
  service; or
- get written commercial reuse permission for a broad official data source; or
- keep those currencies manual-only.

The exact approved currency list is computed for each user by the validation
contract in [Define supported-currency metadata and complete historical
coverage](https://github.com/mastro993/zai/issues/370). It depends on the user's
coverage start. This report does not infer that list from a provider marketing
count.

For this source decision, a **live projection rate** means the latest ECB daily
reference rate that is due and available. The 15-minute product refresh cadence
checks for a newer published observation; it does not imply an intraday market
feed. Zai must show the observation timestamp and stale state required by the
product contract.

## Why the ECB is the approved source

The ECB is the primary authority for its euro reference rates. It publishes one
daily reference rate for 30 currencies on working days, usually at about 16:00
CET. The data starts in January 1999. The rates are for information. The ECB
strongly discourages their use for market transactions. Zai uses them for
personal-finance valuation, not for settlement or trading. See the [ECB exchange
rate page](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html),
the [ECB data overview](https://data.ecb.europa.eu/key-figures/ecb-interest-rates-and-exchange-rates/exchange-rates),
and the [ECB framework](https://www.ecb.europa.eu/stats/pdf/exchange/Frameworkfortheeuroforeignexchangereferencerates.en.pdf).

The ECB Data API supports daily series, date ranges, wildcards for all currencies,
and the `updatedAfter` parameter for small update requests. The daily reference
series has the key form `D.<currency>.EUR.SP00.A`. See the [ECB Data API
guide](https://data.ecb.europa.eu/help/api/data).

The ECB permits commercial and non-commercial reuse if the copy is accurate and
Zai cites the ECB. Zai must also state when it modifies data, such as when it
calculates a cross rate. See the [ECB statistics reuse
policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html)
and the [ECB disclaimer and copyright
rules](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html).

The ECB needs no account and no API key. Thus, the desktop application does not
contain a shared secret. The provider cannot receive an amount, description,
category, note, transaction identifier, or other financial value because the API
does not need those values.

The ECB does not publish every active fiat currency. It can also stop a series.
For example, it suspended the Russian rouble reference rate after 1 March 2022.
Therefore, the number 30 is not proof of complete current coverage for 30
currencies. Zai must test each series and required date range.

## Candidate comparison

| Source | Current and historical data | Access and limits | Licence and storage | Availability and privacy | Result |
| --- | --- | --- | --- | --- | --- |
| ECB Data API | Daily EUR reference rates for 30 currencies. Current series start in 1999 or 2000. Some series can stop. | No account or key. The API supports bulk ranges and delta requests. No public request quota or SLA was found. | Free commercial and non-commercial reuse with ECB attribution. Modified data must be marked. | A fixed all-currency request sends no user financial data. The ECB can log normal request metadata. Local cache is necessary because there is no SLA. | **Approve for the currency and date intersection.** |
| Frankfurter v2 public API | It reports daily data for 165 active and 36 archived codes, from 84 official sources, with overall history back to 1948. Depth differs by currency and source. | No key and no quota. It applies abuse rate limits. It supports ranges, NDJSON, source filters, and source attribution. | The software is MIT licensed and the site permits commercial use. However, Frankfurter says that each underlying source term still applies. | No SLA is published. The public service uses Cloudflare, which collects basic analytics. A private instance needs a persistent database and optional source credentials. | **Do not approve the default blend.** It is useful for research and as an adapter only after an allow-list licence audit. |
| Banca d'Italia REST API | It publishes daily, monthly, and annual rates against EUR and USD. Its portal states that it covers currencies with an ISO code and legal-tender status, subject to source availability. History differs by currency. | Official REST API. No authentication or quota is documented. | The website copyright permits personal saving only. Commercial use and reproduction need prior written permission, unless a data set is separately on the AgID portal under CC BY 4.0. The exchange-rate data was not identified there by this research. | No SLA is published. Fixed broad requests can avoid user-specific data. | **Reject for commercial production without written permission.** |
| ExchangeRate-API | It lists 165 commonly circulating currencies, except KPW. The keyless current feed updates daily. Paid history has full listed-currency coverage only from 2021; a smaller set goes back to 1990. | Keyless current endpoint: rate limited, but one request per hour is within the published guidance. Paid plans use a key and quotas. | Commercial end use and caching are permitted. Attribution is required for the keyless endpoint. Data redistribution is not permitted. | The provider reports more than 99.99% paid API uptime in 2024, but no contractual SLA was found. The provider recommends a server for client-side key use. | **Reject as the complete source.** The keyless feed has no full history. The paid key cannot be safe in the distributed application. |
| Open Exchange Rates | Hourly midpoint rates on standard plans and daily end-of-day history from 1 January 1999. Sources are blended and not disclosed. | An App ID is required. Free tier: 1,000 calls per month. Paid accounts add features and higher limits. A time-series request needs an Enterprise or Unlimited plan. | API documents permit response caching. Commercial applications should use a paid account. Terms grant a limited, revocable right and prohibit direct resale without another licence. Permanent end-user copies are not explicit. | It reports at least 99.9% historical uptime but gives no guarantee unless Zai negotiates an SLA. The App ID is visible in client code. | **Reject for the default desktop path.** It needs a shared paid credential and does not give source-level audit evidence. |
| Xe Currency Data API | 174 current and 36 obsolete fiat currencies. It has 24/7 updates and history from 1999. | Paid annual plan. Each returned rate counts against the plan. The API stops at the plan limit. All calls need confidential credentials. | End users can display rates, but they cannot store or distribute Xe data. Cache data must be removed when it is old. On termination, cached and archived data must be destroyed. Attribution is required. | The contract defines outage remedies, but it permits service and source outages. Standard request metadata is collected. | **Reject.** Its storage and credential terms conflict with immutable local rate snapshots and a distributed desktop client. |

### Candidate evidence

#### Frankfurter

Frankfurter documents its [coverage, history, API, limits, commercial use, and
privacy](https://frankfurter.dev/). Its [currency
catalogue](https://frankfurter.dev/currencies/) gives the start and end year and
provider count for each code. Its [provider
catalogue](https://frankfurter.dev/providers/) identifies 84 central banks and
official sources. The default rate is a blend. A request can use `providers=` to
select a source and `expand=providers` to record source attribution.

The public endpoint has no monthly or daily quota, but it has an abuse rate
limit. The project recommends caching, self-hosting, or direct data queries for
high volume. Its [deployment guide](https://frankfurter.dev/deploy/) says that a
production private instance needs a persistent volume. Some underlying sources
also need credentials. The [public status page](https://frankfurter.instatus.com/)
is useful operational evidence, but it is not an SLA.

The main legal risk is not the Frankfurter code licence. It is the data source.
For example, Frankfurter lists Banca d'Italia as one of its broadest sources.
Banca d'Italia's [copyright
notice](https://www.bancaditalia.it/footer/copyright/?com.dotmarketing.htmlpage.language=1)
forbids profit use and reproduction without written permission, except for data
that it separately publishes through the AgID open-data portal. Thus, a default
blend cannot be treated as commercially cleared.

#### Banca d'Italia

The [official portal](https://www.bancaditalia.it/compiti/operazioni-cambi/portale-tassi/index.html?com.dotmarketing.htmlpage.language=1)
has daily, monthly, and annual data. It states that history for some currencies
starts much later than history for major currencies. The [official REST API
instructions](https://www.bancaditalia.it/compiti/operazioni-cambi/Operating_Instructions.pdf?language_id=1)
define `latestRates`, `dailyRates`, `timeSeries`, and `currencies` endpoints with
JSON, CSV, PDF, or spreadsheet responses.

The [FX market operations
page](https://www.bancaditalia.it/compiti/operazioni-cambi/index.html?com.dotmarketing.htmlpage.language=1)
says that the portal publishes rates for currencies with an ISO code and
legal-tender status. This is good coverage evidence. It is not a commercial
licence. The general copyright notice is the controlling public term found by
this research.

#### ExchangeRate-API

The [keyless endpoint
documentation](https://www.exchangerate-api.com/docs/free) permits commercial
use and caching. It updates daily, requires attribution, and applies an IP rate
limit. The [supported-currency
page](https://www.exchangerate-api.com/docs/supported-currencies) lists 165
commonly circulating currencies and excludes KPW. This list contains codes that
the metadata ticket must classify, such as non-national units and pegged
territory codes.

The [historical endpoint
documentation](https://www.exchangerate-api.com/docs/historical-data-requests)
states that full supported-currency history starts on 1 January 2021. Only a
smaller set has history from 1990 through 2020. History requires a paid plan and
an API key. The [authentication
guide](https://www.exchangerate-api.com/docs/authentication) recommends that
client applications call the provider through the developer's own server. This
server design conflicts with Zai's local-first default.

The [terms](https://www.exchangerate-api.com/terms) permit commercial use but
prohibit redistribution or a product that gives automatic access to the source
data. Zai would need written confirmation that its persistent local cache and
export contract are end use and not redistribution before adoption.

#### Open Exchange Rates

Open Exchange Rates gives [daily end-of-day history from 1 January
1999](https://docs.openexchangerates.org/reference/historical-json). Standard
plans update hourly. The Unlimited plan updates every ten minutes. The [free
plan](https://openexchangerates.org/signup/free) allows 1,000 calls per month.
The provider's [FAQ](https://openexchangerates.org/faq/) says that commercial or
advertising-supported applications should use a paid account. It also says that
the source list is not disclosed, historical values are end-of-day values, and
there is no standard uptime guarantee.

The [ETag documentation](https://docs.openexchangerates.org/reference/etags)
permits a response cache in a file, database, or memory. The public terms do not
give a clear right to put permanent rate copies in every end user's database or
to retain and export them after a contract ends. Zai must get those rights in
writing before it selects this service.

The [authentication
documentation](https://docs.openexchangerates.org/reference/authentication)
says to keep the App ID as secret as possible. It also states that the App ID is
visible in public client code. This does not satisfy Zai's rule that secrets use
the OS keyring and must not be in the application. The [terms](https://openexchangerates.org/terms/)
also make the licence limited, non-transferable, non-exclusive, and revocable.

#### Xe

Xe documents [174 current fiat currencies, 36 obsolete currencies, cache limits,
24/7 updates, and history from 1999](https://help.xe.com/hc/en-gb/articles/4411633342225-How-does-the-Currency-Data-API-work).
Its [package documentation](https://help.xe.com/hc/en-gb/articles/4414092026769-Currency-Data-API-packages-pricing-and-payment)
says that each returned rate counts against the monthly limit and that the API
stops at the limit.

The [Xe licence](https://help.xe.com/hc/en-gb/articles/42977361080721-Xe-currency-data-API-terms-of-use)
requires confidential credentials. It permits display to end users, but it
forbids end-user storage and distribution. It also requires deletion of cached
and archived data after termination. These terms are incompatible with Zai's
reliable, local historical records.

## Required production request contract

Use this contract for the approved ECB path.

### Request contents

- Request a fixed product data set. Do not make requests from the user's enabled
  currencies or transaction dates.
- Request all approved ECB currencies together. For an initial load, use fixed
  calendar-year chunks. For refresh, use `updatedAfter`.
- Send only the ECB series key, a fixed date boundary, format negotiation, and
  normal HTTP metadata.
- Never send an amount, user-selected date, transaction count, description,
  category, note, identifier, or database-derived earliest date.
- Calculate EUR cross rates locally. Mark the value as calculated and retain the
  ECB source series and observations.

The provider will still receive normal network metadata, such as the public IP
address and request time. The request must not let it infer the user's currency
set or financial-history dates. The [ECB Data Portal privacy
statement](https://data.ecb.europa.eu/privacy-statement-ecb-data-portal) states
that technical logs can contain the IP address, requested object, request time,
and result status.

### Authentication

- The approved ECB path has no credential.
- Do not put a commercial shared key in source code, resources, local storage,
  or the application binary.
- If a later contract uses a per-user key, store it in the OS keyring. Do not
  log it. A per-user key does not by itself solve licence, quota, or product UX
  problems.

### Local cache and provenance

- Store normalized daily observations in SQLite by source, series, observation
  date, publication or retrieval time, and source revision identity.
- Keep the raw rate precision. Do not round before the domain conversion rule
  applies.
- Make an actual transaction rate snapshot immutable after Zai accepts it.
- Keep the last known good current table. A network error must not delete or
  replace it.
- Validate the response schema, requested series, dates, finite positive values,
  duplicates, and unexpected currency changes before one database transaction
  commits the update.
- Record that an EUR cross rate is a local calculation. Keep enough source data
  to reproduce it.
- Store licence attribution with the source metadata and show it where the
  product contract requires rate provenance.

### Availability and fallback

- Treat the local cache as the first read source. Network refresh is an update,
  not a dependency for every screen or calculation.
- Use the last known good rate when the product contract permits stale data.
  Show its observation date and stale state.
- If a required historical observation is absent, keep the result incomplete or
  ask for a manual rate. Do not silently substitute a different provider.
- An official ECB CSV or XML download can be an alternate transport for the
  same source. It is not an independent market-data fallback.
- A second provider can be a future fallback only if Zai has approved its
  licence, fixed its precedence, and records its provenance. It must not rewrite
  an accepted actual-rate snapshot.
- Rate limits or outages must use bounded retry with backoff. Do not poll until a
  provider blocks the client.

## Pillar check

**Secure:** The ECB path has no secret. Input validation and one atomic cache
update protect stored rates. A commercial key in a distributed binary fails this
pillar.

**Reliable:** The ECB is the primary source and permits permanent reproduction.
Local-first reads, immutable actual snapshots, provenance, and fail-closed gaps
remove a network request from normal calculations. The trade-off is narrow
currency coverage and no formal SLA.

**Efficient:** One all-currency daily update and delta retrieval replace
per-transaction calls. Cross rates are local. SQLite serves all repeated reads.

**Private:** Fixed broad requests contain no user financial data and do not show
which currencies or dates the user has. The provider still sees normal network
metadata. No Zai cloud service or telemetry is necessary.

## Follow-up gates

The next tickets must not treat this report as proof that all ECB series are
continuous.

- The currency enablement gate must apply the accepted metadata and complete
  historical coverage contract to the user's coverage start, handle
  non-publication days, and exclude a current currency when its required series
  is stopped or incomplete.
- The service contract ticket must define stale behavior, bounded refresh,
  revision handling, and manual recovery.
- The persistence contract ticket must define raw observations, derived cross
  rates, immutable actual snapshots, and attribution.
- Service and UI work must preserve this decision's meaning of live projection
  rate: latest due ECB daily reference rate, not an intraday trading rate.

If broad automatic coverage is mandatory, this decision must reopen only after
Zai has written evidence for commercial use, permanent local storage, desktop
distribution, credentials, quotas, and availability. A marketing coverage count
is not sufficient evidence.
