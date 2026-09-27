---
description: Review VMS screen mockups for UX-flow coherence and visual consistency with ../DESIGN-SPEC-v4.md. Produces a short findings list.
---

# /design-review

Review screen mockups for **flow coherence** first, then **visual consistency**.

## Usage

```
/design-review            # review the whole portal
/design-review <file>     # review a single screen
```

## What happens

1. Run the flow checker and capture its output:
   ```bash
   node scripts/check-flow.mjs
   ```
   This regenerates `FLOWS.md` and reports **dead links** and **orphan screens**.
2. Review flow coherence (the priority):
   - **No orphans** — every screen is reachable from an entry point (`index.html` / sign-in).
   - **No dead links** — every `href` to a screen points to a file that exists.
   - **Back-links / next-steps** — from a detail screen you can get back and forward as a real user would.
3. Spot-check visual consistency against `../DESIGN-SPEC-v4.md` and the skills:
   - **Forbidden terms** — no Commission, Uplift, In Progress, On Hold, Shortlisted, Interviewing, Pending Approval, etc.
   - **Canonical statuses + badge colours** — status strings and pill classes match the spec (see the **status-badges** skill); `Overdue` is a separate red pill.
   - **Shell consistency** — shared `<head>` (Tailwind config, Sora/Manrope, Font Awesome), navy `w-64` sidebar, `h-16` header.
   - **Accessibility** — landmarks, `aria-label` on icon-only buttons, focus states, alt text.

## Output

A short findings list grouped by screen (flow issues first):

```
FLOW
  ❌ dead link: client.demand.vacancy-detail.html → booking-detail.html (no such screen)
  ⚠️ orphan: client.candidates.candidate-directory.html (nothing links here)

client.identity-access.sign-in.html
  ⚠ icon-only button missing aria-label (line 40)
```

Report findings only — do not change visual design intent unless the user asks.
