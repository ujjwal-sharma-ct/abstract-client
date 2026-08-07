---
name: accessibility
description: Baseline accessibility for VMS mockups — semantic landmarks, `aria-label` on icon-only buttons, visible focus states, colour-contrast notes, and alt text. Use when adding interactive elements, icon buttons, images, or when reviewing a screen for a11y gaps.
paths: ['*.html']
---

# Accessibility (mockups)

These are static mockups, but they must model correct semantics so the built
product inherits them. Cheap to get right; obvious when wrong.

## Landmarks & headings
- One `<aside>` (sidebar nav wrapped in `<nav>`), one `<header>`, one `<main>` per screen.
- Exactly one `<h1>` (in the header, matching `<title>`). Section titles step down `<h2>`/`<h3>` — never skip levels for styling.
- Mark the active nav link with `aria-current="page"` (see `layout-shell`).

## Icon-only buttons — always label

```html
<button aria-label="Notifications" class="w-9 h-9 rounded-lg hover:bg-lightgrey flex items-center justify-center">
  <i class="fa-regular fa-bell" aria-hidden="true"></i>
</button>
```
- Every icon-only control gets an `aria-label` describing the action ("Open VAC-1042", "Close", "Notifications").
- Decorative `<i>` icons get `aria-hidden="true"` so they aren't announced.

## Focus states
- Never remove focus outlines without a replacement. Use a visible ring:

```html
class="… focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-1"
```
- Inputs: `focus:ring-2 focus:ring-blue/40` (see `components` filter bar).

## Colour & contrast
- Never signal status by colour alone — the badge always includes its text label (e.g. "Overdue"), so colour is reinforcement, not the sole cue.
- Body text is `text-gray-800` / `text-slate-600` on white/light-grey — meets contrast. Avoid `text-slate-400` for anything but decorative/placeholder text.
- Navy sidebar uses `text-white` (active) and `text-white/70` (inactive) — both pass on `bg-navy`.

## Images
- Meaningful images: descriptive `alt`. Decorative images/avatars-as-initials: `alt=""` (or use text initials, as in the shell footer).

## Modals
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the title (see `components` modal). Provide a labelled close button.

## Quick checklist
- [ ] one `<h1>`, ordered headings
- [ ] `<nav>` / `<main>` / `<header>` landmarks present
- [ ] every icon-only button has `aria-label`; decorative icons `aria-hidden`
- [ ] visible focus ring on all interactive elements
- [ ] status conveyed by text + colour, not colour alone
- [ ] images have appropriate `alt`
