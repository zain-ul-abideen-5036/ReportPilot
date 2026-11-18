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
| Display and big figures | Fraunces | Variable, with optical size and the SOFT axis set to 60 for a warm, rounded serif; the WONK italic marks emphasis |
| Interface and body | Hanken Grotesk | 400, 500, 600 and 700 |
| Code and identifiers | Geist Mono | Property ids, paths |

Scale: micro 11, small 13, body 14, lead 16, title 22, headline 32, figure
40. Tracking tightens as size grows. All tables use tabular figures.

## Colour

One theme, "Paper & Pine": a single light palette, deliberately not
switchable, so every screen and every screenshot is the designed one. Tokens
live in `apps/web/src/app/globals.css`.

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#f6f2ea` | Page ground, with a faint SVG grain |
| `raised` | `#fffdf9` | Cards, inputs |
| `ink` | `#17201c` | Text |
| `accent` | `#1d4a3c` | Active state, links, chart lines |
| `brass` / `copper` | `#b4813f` / `#c0683a` | Section numbers, emphasis, the warm end of the gradient |
| `good` / `watch` / `act` | green / amber / red | Status, always with an icon |

**Signature gradients.** Pine flowing into brass (`--grad-brand`) on primary
buttons, the logo and the closing call to action; the same ramp as text
(`.text-gradient`) on one emphasised word per page; a hairline version
(`.rule-gradient`) above each landing chapter; and a soft apricot-and-sage
glow (`.glow`) behind hero areas that drifts slowly. Never purple into blue.

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

Only `transform` and `opacity` are animated. Beyond state changes, the
landing page uses a drifting glow, floating proof chips, count-up figures, a
report token travelling along the pipeline track and a slow marquee. The landing page reveals
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
