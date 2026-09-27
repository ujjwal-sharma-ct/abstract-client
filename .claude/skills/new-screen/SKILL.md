---
name: new-screen
description: Checklist for adding a NEW VMS screen mockup — filename convention, starting from the shared `<head>` + shell, using canonical badges, and wiring it into the flow (link to/from it, regenerate FLOWS.md). Use when creating any new `.html` screen.
paths: ['*.html']
---

# New Screen — add a mockup

One screen per `.html` file, all CSS/JS inline, consistent with existing mockups.

## 0. Understand the scope first (BRD)

Before building, read the relevant section of `../BRD-VMS-v3-Complete.md` (and `../domain-model.md`
for the entities/fields) to learn **what this screen must support** — the fields, statuses, actions,
and rules for its area. The screen must reflect that scope; don't invent scope the BRD doesn't have,
and don't omit what it requires.

## 1. Filename convention

```
<portal>.<module>.<page>.html
```
- `<portal>` = `client` in this repo (`abstract` | `agency` | `client` across the three).
- `<module>` = the feature module the screen belongs to — the first segment of the feature-ledger
  capability id (`identity-access`, `demand`, `timesheets`, …; `shell` for chrome-only pages). Full list: `../NAMING.md`.
- `<page>` = kebab-case slug of the screen (`vacancy-detail`, `create-proposal`); a slice-scoped variant
  of an existing page takes the suffix `-slice-<N>`.
- Example: `client.demand.vacancy-detail.html`
- Lower-case, dots between the three segments, hyphens inside a segment, no spaces or numbers.

## 2. Start from the shared boilerplate
- Paste the canonical `<head>` from `design-system` (Tailwind config, fonts, Font Awesome, Plotly-if-charting).
- Paste the `layout-shell` skeleton: navy sidebar + `h-16` header + scrollable `<main>`.
- Set `<title>` to `<Portal> · <Screen>` and make the header `<h1>` match.

## 3. Build content from shared patterns
- Use `components` blocks (KPI cards, tables, filter bar, modal, empty state).
- Use `status-badges` for every status — canonical strings only, correct colour bucket, Overdue as a separate pill.
- Use `charts` for any Plotly chart (brand colours, no toolbar, responsive).
- Apply `accessibility` baseline (landmarks, aria-labels, focus rings, alt).

## 4. Wire it into the flow (the priority)
- Add a link **to** the new screen from wherever the user reaches it (the index and/or the prior screen).
- Add links **from** the new screen to its next steps, and a way back.
- Regenerate the flow map and confirm no dead links / orphans:
  ```bash
  node scripts/check-flow.mjs
  ```

## 5. Check consistency against the spec
- Open `../DESIGN-SPEC-v4.md`. Confirm: no FORBIDDEN terms (Commission, Uplift, In Progress, On Hold, Shortlisted, Interviewing, Pending Approval…), all statuses canonical, badge classes match the mapping.

## 6. Note it for continuity
- Add a one-line entry to `PROGRESS.md` (what screen, why). `FLOWS.md` is regenerated, not hand-edited.

## Definition of done
- [ ] filename follows `<portal>.<module>.<page>.html` (`../NAMING.md`)
- [ ] canonical `<head>` + layout shell present
- [ ] statuses/badges canonical (no forbidden terms)
- [ ] linked to/from the flow; `node scripts/check-flow.mjs` shows no dead links/orphans
- [ ] `PROGRESS.md` updated
