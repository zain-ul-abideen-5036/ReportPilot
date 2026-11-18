# 0005: Store monthly aggregates, not raw rows

**Status:** accepted

## Context

Search Console can return tens of thousands of query and page rows per site
per month. Free Postgres tiers offer around 0.5 GB.

## Decision

Store site totals per day, the top 1,000 queries and top 500 pages per month,
and device and country splits. Keep raw uptime checks for 90 days and roll
them into a daily table that is kept forever.

## Consequences

- 50 sites × 1,000 queries × 12 months is about 600,000 rows: comfortably free.
- Long-tail queries beyond the top 1,000 are not retained. They rarely change
  a report's conclusions, and Google anonymises the rarest anyway.
- Re-deriving an old report needs only the stored aggregates.
