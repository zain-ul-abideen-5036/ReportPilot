# 0006: A resumable, idempotent pipeline

**Status:** accepted

## Context

A monthly job that touches several external APIs for every site will
sometimes fail halfway: a quota error, a crashed browser, a network blip.
Re-running from scratch wastes quota and risks emailing a client twice.

## Decision

- Reports are keyed on `(site_id, period)` with a unique index; planning is
  an upsert.
- Each stage saves its output (collected data, report data, narrative, PDF
  key) before the next starts. The runner skips completed stages.
- Each stage retries with exponential backoff, then marks the report
  `failed` without losing earlier work.
- A sent report is never processed again.

## Consequences

- Re-running the workflow is always safe, which is why it is scheduled on
  three consecutive days.
- Stage outputs are stored as JSON on the report row, which costs some space.
- Both properties are unit tests: "running twice creates one report and
  sends once" and "resumes from the failed stage instead of starting again".
