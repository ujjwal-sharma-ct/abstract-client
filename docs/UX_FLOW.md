# Working in this UX-flow prototype

This repo is a set of **static HTML mockups** that demonstrate the VMS Client portal's screens and
how a user moves between them. It's a design/flow artifact — **no build, no framework, no code-quality
tooling**. Two things matter: the **flow stays coherent**, and **continuity is maintained**.

## The pieces

| File | Role |
| --- | --- |
| `*.html` | The screens — one per file, openable directly in a browser. |
| `FLOWS.md` | The **flow map** — every screen and what it links to. Auto-generated. |
| `PROGRESS.md` | Current state: what changed, what's next. Update it when you touch screens. |
| `DECISIONS.md` | Append-only *why* behind design/flow choices. |
| `scripts/check-flow.mjs` | Regenerates `FLOWS.md`; reports dead links + orphan screens. |
| `../DESIGN-SPEC-v4.md` | Shared visual reference (status vocabulary, forbidden terms, badge colours). |
| `.claude/` | The AI kit: skills (how a screen looks), commands (`/new-screen`, `/design-review`), the `design-reviewer` agent. |

## The one command you'll run

```bash
node scripts/check-flow.mjs
```

It rewrites `FLOWS.md` from the actual `href` links and tells you about **dead links** (a screen links
to a file that doesn't exist) and **orphans** (a screen nothing links to — unreachable in the journey).
Run it whenever you add, remove, or re-link a screen.

## Adding or changing a screen

1. `/new-screen Client - <Screen name>` (or edit an existing `.html`).
2. **Wire it into the flow** — link *to* it from where the user arrives, and *from* it to the next steps + a way back. This is the point of the repo.
3. `node scripts/check-flow.mjs` → confirm no dead links / orphans; `FLOWS.md` updates.
4. Keep it visually consistent — reuse the shared `<head>` + sidebar/header shell and canonical status badges (the skills show how; `../DESIGN-SPEC-v4.md` is the reference).
5. **Continuity:** add a one-line note to `PROGRESS.md` (what + why); log a `DECISIONS.md` entry if you made a real flow/design call.

## Reviewing

`/design-review` (or the `design-reviewer` agent) checks flow coherence first (dead links, orphans,
back-links), then spot-checks visual consistency against the spec. It reports; it doesn't redesign.

## What this repo deliberately does NOT have

No `package.json`, no linter/formatter, no tests, no git hooks. Consistency is *guided*, not gated —
because the deliverable is a clickable demonstration of the flow, not production code.
