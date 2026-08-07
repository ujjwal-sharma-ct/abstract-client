# AGENTS.md — UX-Flow Prototype Rules

> This repo is a set of **static HTML mockups** that demonstrate the VMS **UI/UX flow** — one screen per `.html` file, openable directly in a browser. It is a design/flow deliverable, **not an application**. There is no build step, no framework, and code hygiene (linting, formatting, tests) is explicitly **out of scope**. What matters here is that **the flow stays coherent** and **continuity is maintained** across sessions.

---

## What "good" means here

- **Coherent flow:** every screen is reachable, links go to screens that exist, and the click-path matches the intended user journey.
- **Consistent screens:** new/edited screens reuse the shared look (sidebar + header shell, brand palette, Sora/Manrope, canonical status badges) so the prototype reads as one product.
- **Continuous context:** anyone (human or AI) picking this up next can tell what changed and why from `PROGRESS.md` + `FLOWS.md`.

Explicitly **not** goals: passing tests, formatting rules, framework conventions, production-readiness.

---

## Scope authority — read BEFORE building or reviewing a screen

The BRD defines **WHAT** the product must do; it is the source of truth for a screen's scope — its
fields, states, actions, and rules. `DESIGN-SPEC-v4.md` only governs how it looks. Before you create
or review a screen, consult the relevant sections of:

- `../BRD-VMS-v3-Complete.md` — the VMS Business Requirements (features, rules, acceptance criteria).
- `../domain-model.md` — the entities, fields, and relationships the screens visualize.
- `../BRD-VMS-Competitor-Backlog.md` — competitor/feature backlog and gaps.

Rules:
- A screen **must reflect the BRD scope** for its area — don't omit required fields/actions.
- A screen **must not invent scope** that contradicts the BRD or domain model.
- These docs live in the workspace root (one level up, shared by all three portals). Read the `.md`
  versions; the `.docx` is a fallback only. If a repo is ever used standalone, copy the BRD in.

---

## Flow rules (the priority)

1. **Every screen links into the flow.** When you add a screen, link **to** it from wherever the user would reach it, and link **from** it to its next steps (and back). No orphans.
2. **No dead links.** An `href` to another screen must point to a file that exists. `scripts/check-flow.mjs` enforces this.
3. **Keep `FLOWS.md` current.** Regenerate it (`node scripts/check-flow.mjs`) whenever you add, remove, or re-link a screen — it is the map of the journey.
4. **Entry points** are `index.html` and any sign-in/login screen; everything else must be reachable from them by following links.

---

## Consistency rules (so the flow reads as one product)

5. Reuse the shared `<head>` (Tailwind CDN config + Sora/Manrope) and the sidebar/header **layout shell** — don't invent new chrome per screen. See the `design-system` and `layout-shell` skills.
6. Use the canonical **status vocabulary** and **status→badge-colour** mapping, and avoid the **forbidden terms** — all defined in `../DESIGN-SPEC-v4.md`. (This is a reference, not a lint gate; the `design-review` command spot-checks it.)
7. Descriptive `<title>` per screen; filename convention `N-<Portal> - <Screen>.html`.

---

## Continuity

- **Clock-in:** read `PROGRESS.md` and `FLOWS.md` → continue.
- **Clock-out:** when you change screens, update `PROGRESS.md` (which screens, and why) and regenerate `FLOWS.md` (`node scripts/check-flow.mjs`); log a design/flow decision in `DECISIONS.md` if you made one.
- This is a **habit, not a gate** — there are no git hooks, no build, no CI. Keeping `PROGRESS.md`/`DECISIONS.md`/`FLOWS.md` current is how the next session (human or AI) picks up without losing context.

---

## Ask a human before

- Changing the shared journey structure (reordering major steps, removing screens).
- Editing `../DESIGN-SPEC-v4.md` (it governs all three portals).
- Introducing a new navigation pattern or page chrome.

---

## Pointers

- Flow map: `FLOWS.md` · Flow checker: `scripts/check-flow.mjs`
- Scope/requirements: `../BRD-VMS-v3-Complete.md` · `../domain-model.md` · `../BRD-VMS-Competitor-Backlog.md`
- Visual reference: `../DESIGN-SPEC-v4.md`
- Recipes: `.claude/skills/` · Commands: `/new-screen`, `/design-review`
- Guide: `docs/UX_FLOW.md` · State: `PROGRESS.md` · `DECISIONS.md`
