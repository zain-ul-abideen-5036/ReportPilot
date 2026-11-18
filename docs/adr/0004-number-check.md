# 0004: The number check on AI-written text

**Status:** accepted

## Context

Template sentences are accurate but can read stiffly. Language models phrase
well but are unreliable with figures: they round, invent and transpose. A
report that misquotes a client's own numbers does more damage than one that
reads a little mechanically.

## Decision

The AI is only ever asked to *rewrite* the template summary, never to write
from data. Its output is accepted only if:

1. every number in it appears in the source text, after normalising commas,
   signs and trailing zeros;
2. it keeps at least half of the source's figures; and
3. it is not trivially short.

Otherwise the template is used. AI can be turned off per client, and only
aggregated metrics are sent, never contact details.

## Consequences

- AI improves flow without being trusted with facts.
- Some good rewrites are rejected, for example "about 18%" for "18.3%". That
  is the intended trade.
- The check is a pure function with unit tests in `packages/core`.
