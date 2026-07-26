# Keep cash-flow grouping in the user interface only

Zai uses the Cash flow area as a presentation convention, not as a shared
feature boundary. APIs and non-UI modules are organized around transactions,
categories, budgets, recurring transactions, and other distinct features; the
Web API uses one `/api` root with feature resource paths instead of an
`/api/cash-flow` namespace. Financial terms such as Net cash flow remain where
they describe actual money movement. Because Zai has no stable public release,
the old API paths are removed atomically without aliases or redirects. Removing
the grouping does not redesign feature ownership, resource paths below that
grouping, payloads, commands, services, persistence, or behavior.
