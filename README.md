# VMS Client Portal — UX-Flow Mockups

Static HTML mockups demonstrating the **Client portal** screens and user journey for the VMS.
Each `.html` opens directly in a browser (Tailwind CDN + Font Awesome + Plotly, all inline).
This is a **design/flow deliverable, not an app** — no build, no dependencies.

## Quick start

- Open `index.html` in a browser to walk the flow, or open any screen directly.
- See the whole journey at a glance in **[`FLOWS.md`](FLOWS.md)**.
- Regenerate the flow map any time:
  ```bash
  node scripts/check-flow.mjs
  ```
  (Node only — nothing to install.)

## Working here with AI

This repo carries a lightweight AI kit tuned for **flow + continuity**, not code quality:

- **[`docs/UX_FLOW.md`](docs/UX_FLOW.md)** — how to add/change screens and keep the flow coherent.
- `CLAUDE.md` / `AGENTS.md` — the rules the AI follows here.
- `.claude/` — skills (design-system, layout-shell, status-badges, components, charts, accessibility, new-screen), commands `/new-screen` and `/design-review`, and a `design-reviewer` agent.
- `PROGRESS.md` / `DECISIONS.md` — keep these current so the next session has context.
- Visual reference: `../DESIGN-SPEC-v4.md` (shared across all three portals).

## Layout

```
*.html                 the screens (one per file)
index.html             entry point → Sign In → Dashboard → …
FLOWS.md               auto-generated navigation map
PROGRESS.md            current state (update when screens change)
DECISIONS.md           why behind flow/design choices
scripts/check-flow.mjs flow map generator + dead-link/orphan check
.claude/               skills, commands, agent
docs/UX_FLOW.md        working guide
```
