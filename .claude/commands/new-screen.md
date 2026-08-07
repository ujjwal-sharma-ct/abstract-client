---
description: Scaffold a new VMS screen mockup following the design system, layout shell, and DESIGN-SPEC.
---

# /new-screen

Create a new standalone HTML screen mockup, consistent with the existing design language.

## Usage

```
/new-screen <Portal> - <Screen name>
```

Examples:
- `/new-screen Client - Vacancy Detail`
- `/new-screen Agency - Candidate Submissions`

## What happens

1. Determine the next screen number `N` (highest existing + 1) and create
   `N-<Portal> - <Screen>.html` in the repo root.
2. Follow the **new-screen** skill:
   - paste the canonical `<head>` from **design-system**,
   - paste the **layout-shell** (navy sidebar + header + scrollable main),
   - set `<title>` and header `<h1>` to `<Portal> · <Screen>`,
   - build content from **components**, **status-badges**, **charts**, applying the **accessibility** baseline.
3. Use only canonical statuses (no FORBIDDEN terms) per `../DESIGN-SPEC-v4.md`.
4. **Wire it into the flow:** link to the new screen from `index.html` (and the prior screen), and link from it to its next steps + a way back.
5. Run `node scripts/check-flow.mjs` to regenerate `FLOWS.md` and confirm no dead links/orphans.
6. Add a one-line `PROGRESS.md` note. Report the new filename and the flow-check result.

Touch the new file, the screens that link to/from it, `index.html`, and `PROGRESS.md`. Do not restyle other screens.
