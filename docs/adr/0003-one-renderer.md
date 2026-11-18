# 0003: One renderer for preview and PDF

**Status:** accepted

## Context

Account managers approve a report in the dashboard; clients receive a PDF.
If those are produced by different code they drift, and the thing that was
approved is not the thing that was sent.

## Decision

The report is a set of React components (`packages/report`) with print
geometry: A4 at 96 dpi, 794 × 1123 px. The dashboard scales them with a CSS
transform for the preview. The pipeline renders the same components to HTML
and prints them with Playwright's `page.pdf()`; the dashboard's download
route prints its own `/print/[id]` page.

## Consequences

- What is approved is pixel-for-pixel what is sent.
- Charts must be static SVG (see 0007) and styles scoped under `.rp`.
- Brand colours flow through CSS custom properties, so white-labelling comes
  down to two variables.
- Next.js forbids importing `react-dom/server` in route modules, which is why
  the download route prints a page rather than rendering a string.
