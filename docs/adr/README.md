# Architecture decision records

Short records of decisions that shaped ReportPilot: the context, what was
decided, and what it costs. New decisions get the next number; superseded
ones are marked, not deleted.

| # | Decision |
| --- | --- |
| [0001](0001-split-runtimes.md) | Run uptime, monthly jobs and the dashboard on three different free runtimes |
| [0002](0002-service-account-auth.md) | Authenticate to Search Console with a service account, not OAuth |
| [0003](0003-one-renderer.md) | Render the dashboard preview and the PDF from the same React components |
| [0004](0004-number-check.md) | Accept AI-written text only if every figure appears in the source |
| [0005](0005-store-aggregates.md) | Store monthly aggregates instead of raw Search Console rows |
| [0006](0006-resumable-pipeline.md) | Persist every pipeline stage and key reports on site and month |
| [0007](0007-hand-rolled-charts.md) | Draw charts as hand-written SVG instead of using a chart library |
