# 0007: Hand-written SVG charts

**Status:** accepted

## Context

The report needs a handful of chart types: sparklines, a daily trend with a
comparison line, an uptime strip, vital trends with threshold bands and a
split bar. They must render on the server, print crisply and look identical
in the dashboard and the PDF.

## Decision

Write them as small React components emitting SVG (`packages/charts`), with
a monotone cubic curve so lines never overshoot below zero, and colours
taken from CSS variables.

## Consequences

- No chart library in the bundle and no canvas, so the PDF is vector.
- The same chart re-themes for each agency's brand.
- New chart types take a little more effort than with a library.
