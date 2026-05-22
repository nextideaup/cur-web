# CI Cost Mode — cur-web

**Mode:** Cost-aware
**Set:** 2026-05-22 (CUR-20)
**Owner:** Phil

Per NIU-12 §5.14, every repo declares one of three modes:

- **Normal** — full gate set, full cadence.
- **Cost-aware** — §5.6–§5.11 levers applied (draft-PR skip, paths-ignore floor, same-ref cancel, etc.). Recommended for any web app under active development.
- **Lockdown** — `workflow_dispatch` everywhere. Budget emergencies only.

## Why Cost-aware for cur-web

cur-web is pre-production (Tier 1, <500 LOC). Traffic is bursty during active
feature development. Cost-aware levers prevent docs-only PRs and draft pushes
from burning runner minutes.

## Levers in effect

- §5.6 — Draft-PR skip on all gates (`if: github.event.pull_request.draft == false`).
- §5.7 — `paths-ignore` floor on all workflows (`**.md`, `docs/**`, etc.).
- §5.8 — `skip-ci` label honored on all gates.
- §5.9 — Same-ref concurrency cancel on long gates (`e2e`).
- §5.11 — Per-gate trigger discipline:
  - `ci`, `build` — PRs to `main` (cur-web has no `staging` branch today).
  - `secret-scan` — PRs to `main` + weekly Monday cron.
  - `e2e` — stub today (Playwright not yet wired). When implemented, PRs to `staging` only.

## Mode change log

| Date | From → To | Reason |
| --- | --- | --- |
| 2026-05-22 | (initial) → Cost-aware | CUR-20: declare mode while completing the gate set. |
