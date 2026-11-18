# Design system

ReportPilot is a trust-first tool: account managers check figures, and
clients read the result. The interface is quiet and editorial so the numbers
carry the weight.

## Principles

1. **The figure is the hero.** Large numbers in the display serif, labels
   small and grey, changes coloured by whether they are good for that metric.
2. **Status is never colour alone.** Every light and badge has an icon and a
   label, so it survives colour-blindness and greyscale print.
3. **Most things are not cards.** Sections are a heading and a hairline.
   Cards are reserved for discrete objects: a report, an alert, a table.
4. **Motion carries information or it goes.** A rail slides to show where
   you are, a press scales to show it registered, a chart draws once to show
   it is data. Nothing loops.

## Type

| Role | Face | Notes |
| --- | --- | --- |
| Display and big figures | Newsreader | Optical sizes; italic for emphasis and section numbers |
| Interface and body | Geist | 400, 500 and 600 |
| Code and identifiers | Geist Mono | Property ids, paths |

Scale: micro 11, small 13, body 14, lead 16, title 22, headline 32, figure
40. Tracking tightens as size grows. All tables use tabular figures.

## Colour

One accent and one grey family. Tokens live in `apps/web/src/app/globals.css`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#f5f3ee` | `#121412` | Page ground |
| `raised` | `#ffffff` | `#1c201d` | Cards, inputs |
| `ink` | `#191c1a` | `#ebece7` | Text |
| `accent` | `#1f4d3f` | `#8cc2a9` | Primary actions, active state, chart lines |
| `good` / `watch` / `act` | green / amber / red | lighter equivalents | Status, always with an icon |

The client PDF uses the agency's own `primary` and `accent` instead, through
`--rp-primary` and `--rp-accent`. The branding page warns when a primary
colour has less than 4.5:1 contrast on white.

## Motion

One easing curve, three durations, defined as tokens:

| Token | Value | Used for |
| --- | --- | --- |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Everything |
| `--duration-instant` | 90 ms | Press feedback |
| `--duration-fast` | 160 ms | Hover, focus, colour |
| `--duration-settle` | 280 ms | Entrances, panels, drawer |

Only `transform` and `opacity` are animated. The landing page reveals
sections with CSS scroll timelines, with no scroll listeners. Under
`prefers-reduced-motion` durations collapse to near zero and everything
lands in its final state; an end-to-end test asserts headings are fully
opaque with reduced motion on.

## Layout

- Content is capped at 1320 px in the app and 1240 px on the landing page.
- Below 1024 px the sidebar becomes a drawer; below 768 px tables become
  cards with the same fields in the same order, and the report review splits
  into Review and Preview tabs.
- Side gutters are 16 px on phones.

## Icons

Phosphor, regular weight for navigation and fill for active or status
states. No emoji, no mixed sets.
