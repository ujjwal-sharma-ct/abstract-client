---
name: status-badges
description: Canonical VMS status badges — the pill shell, the full status→colour mapping, and the separate Overdue pill rule. Use whenever a screen shows a status/state, when a badge colour looks wrong, or to confirm a status string is canonical (never a FORBIDDEN term).
paths: ['*.html']
---

# Status Badges

Statuses are a **fixed vocabulary**. Use only canonical strings from
`../DESIGN-SPEC-v4.md`. Never invent states and never use FORBIDDEN terms:
**Commission, Uplift, In Progress, On Hold, Shortlisted, Interviewing,
Pending Approval** (and anything else on the spec's forbidden list).

## Badge shell (all badges)

```html
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
  <i class="fa-solid fa-circle text-[6px]"></i> Status
</span>
```

Append ONE colour set from the table below to the shell.

## Status → colour mapping

| Meaning            | Classes to append                                              | Example statuses                                              |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Neutral / draft    | `bg-slate-100 text-slate-700 border border-slate-200`          | Draft, Pending Start, Not Booked                             |
| Info / in-flight   | `bg-blue-50 text-blue-700 border border-blue-200`              | Submitted, Under Review, Generated, Open                     |
| Purple / released  | `bg-purple-50 text-purple-700 border border-purple-200`        | Released to Agencies, Sent                                   |
| Amber / waiting    | `bg-amber-50 text-amber-700 border border-amber-200`           | Partially Filled, Pending, Extended, Acknowledged            |
| Green / good end   | `bg-emerald-50 text-emerald-700 border border-emerald-200`     | Filled, Active, Accepted, Approved, Paid, Compliant, Completed |
| Red / bad end      | `bg-red-50 text-red-700 border border-red-200`                 | Cancelled, Rejected, Expired, Disputed, Overdue              |
| Slate / closed     | `bg-slate-100 text-slate-500 border border-slate-200`          | Closed, Withdrawn, Invoiced, Credited                        |

## Examples

```html
<!-- Released -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
  Released to Agencies
</span>

<!-- Good terminal -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
  <i class="fa-solid fa-check text-[10px]"></i> Filled
</span>
```

## Overdue rule (important)

`Overdue` is a **separate red pill placed next to** the status badge — never
instead of it. An overdue item still has its own lifecycle status.

```html
<div class="flex items-center gap-2">
  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
    Pending
  </span>
  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
    <i class="fa-solid fa-clock text-[10px]"></i> Overdue
  </span>
</div>
```

## Checklist
- String is canonical (verify against `../DESIGN-SPEC-v4.md`) and NOT a forbidden term.
- Colour bucket matches the meaning table, not a guess by vibe.
- Overdue is additive, never a replacement for the lifecycle status.
