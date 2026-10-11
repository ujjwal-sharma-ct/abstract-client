# Decisions Log

Append-only. Newest at the bottom. Records the *why* behind design/flow choices so a future
session doesn't relitigate them.

---

## 2026-07-31 — This repo optimizes for flow + continuity, not code quality

**Context:** These are directly-openable HTML mockups whose only job is to demonstrate the app's
UI/UX flow. Linting, formatting, and framework conventions add friction with no payoff here.

**Decision:** The AI kit tracks exactly two things — **flow integrity** (`scripts/check-flow.mjs`
regenerates `FLOWS.md` and flags dead links/orphans) and **continuity** (`PROGRESS.md` +
`DECISIONS.md`, updated by habit when screens change). No package.json, no prettier, no test
harness, no git hooks. Visual consistency is *guided* by the skills + `../DESIGN-SPEC-v4.md`, not
hard-gated.

**Consequences:** Fast to iterate; the flow map stays honest; nothing to install or run at commit time.

---

## 2026-07-31 — Shifts drive rates; per-day booking gets a client-approval loop

**Context:** Timesheet rates were a single flat per-candidate number, so a night shift billed the
same as a day shift. And the agency had no timesheet surface at all — it could only justify an
absence from deep inside one Booking Detail. The client asked (a) rates to follow the **shift**,
(b) the agency to see timesheets and **book/unbook** candidates per day, and (c) a client
**approval** when the agency un-books a future day.

**Decision:**
1. **Shift is a first-class concept.** A client's onboarding (`../abstract admin/21-…Onboard Client.html`,
   Step 4) defines named shifts (Morning/Afternoon/Night) with a time window and a **role × shift**
   pay/charge matrix. Every *Worked* day carries a `shift`; charge = hours × the shift's rate.
   Canonical visuals: `fa-sun` (06–14), `fa-cloud-sun` (14–22), `fa-moon` + **dark cell** (22–06).
   Default when marking a day = the candidate's last worked shift that week, else Morning.
2. **Agency owns per-day scheduling; client owns approval of future un-bookings.** The agency
   (`../agency login/22-…Timesheets.html`) can book/unbook a day directly for past/current days,
   but un-booking a **future day of an engaged candidate** creates a **"Pending client approval"**
   request instead. The client responds **Approve / Deny / To-be-discussed** (inline on the
   Timesheets page *and* in the new Notifications screen). Abstract monitors the whole loop
   (`../abstract admin/10-…Client Wee.html`).

**BRD divergence (intentional):** The BRD has the **client** mark `Not Booked` days (TS-015) and the
agency only *justify* absences (TS-020–024); agencies never drive scheduling. This change hands
per-day booked/not-booked control to the **agency** and adds a **client-approval gate** on future
un-bookings — a new workflow beyond current BRD scope, built per explicit user request. Segregation
is preserved: client sees charge only, agency sees pay only (gated to after the invoice cycle),
Abstract sees both. If this is adopted, fold it back into the BRD (new TS requirements) so the docs
and mockups stay in step.

**Consequences:** Rates are shift-accurate end-to-end; the agency gains a real timesheet surface;
the booking-change loop is visible to all three parties. The shift model is illustrative (a fixed
Morning/Afternoon/Night set with charge multipliers) rather than fully data-driven.

---

## 2026-08-06 — A worked shift can be recorded against a different role (rate follows the role)

**Context:** Occasionally a candidate works a shift in a role other than their assigned one — e.g. a
**Warehouse Operative** covers as an **FLT Driver** when a driver is absent. That shift's pay and
charge should follow the *covered* role, not the assigned one. The person filling the timesheet
needs to change the role for that single shift, and the change must be visible on the grid.

**Decision:**
1. **Role is resolved per worked day, not just per candidate.** Rate now resolves by **role × shift**
   (BRD RT-015 / TS-038/039): charge = hours × `ROLES[role].base` × shift multiplier. A `ROLES` rate
   card replaces the old flat per-candidate `base`; each candidate has an assigned `roleKey` + `bu`,
   and a *Worked* day may carry a `role` override (stored only when it differs from the assigned role).
2. **Day-entry modal gets a "Role for this shift" block.** It shows the assigned role in a **disabled
   dropdown** with a **Change role** button; clicking unlocks the dropdown (button → **Reset**). Picking
   a role re-prices the shift tiles and the est. day charge live. A purple "Role changed" pill + note
   spell out the cover ("Covering *FLT Driver* … assigned role: *Warehouse Operative*").
3. **Changed cells are highlighted on the grid** — purple ring + a `fa-right-left` corner badge + the
   covering role's short name — with a matching legend entry, so a role change is evident at a glance.
4. **Permission gate.** A `VIEWER` / `CAN_EDIT_ROLE` flag governs the ability. Only **Abstract admin**
   and the **client** may change a role; the **agency admin is view-only** in timesheets (enforced in
   the agency portal, which has no hours/role entry at all). When `CAN_EDIT_ROLE` is false the block is
   read-only with a lock note.

**BRD alignment:** Consistent with RT-015 (role × shift rates) and TS-038/039 (rate resolved by role ×
shift when hours are recorded). The *ad-hoc per-shift role override* itself is a small extension beyond
current TS wording — fold a note into §7.6.7 if adopted. Segregation preserved: client still sees
**charge rates only**.

**Cross-portal propagation (done 2026-08-06):**
- **Abstract admin** `../abstract admin/10-…Client Wee.html` — the admin-on-behalf drill-down grid now
  resolves charge **and pay** per worked day by role (role rate card), the inline cell editor gained a
  locked role dropdown + **Change role** button, worked cards flag a role change (purple card + swap
  badge + covered-role pill), and the week financial summary shows **"Mixed · role change"** when roles
  differ. Marcus Reid's Friday is seeded as an FLT cover.
- **Agency** `../agency login/22-…Timesheets.html` — **read-only**: worked cells covered in another role
  are highlighted (purple ring + swap badge + covered-role tag + tooltip) with a legend entry; no edit
  affordance (agencies never enter hours/roles). Grace Owusu's Wednesday is seeded as an FLT cover.
- **Shared docs:** BRD **v4.4** adds TS-049–051 (§7.6.7) + a user story; `../DESIGN-SPEC-v4.md` §6.5 adds
  the per-shift role-change pattern (who can edit, the purple cell treatment, mixed-rate summary).

## 2026-09-26 — Slice 1 screens: kernel system, shared kit, "slice 1 mode" instead of stripping

**Context:** The slice 1 design brief (`Abstract-VMS-plan/docs/slices/1/design/DESIGN-BRIEF.md`)
asks for missing slice 1 screens and for corrections that remove later-slice content (KPI
dashboards, business units/branches, org-level overrides). This repo shows the *whole* product,
so deleting that content would lose the later slices' design.

**Decision:**
1. New slice 1 screens follow the kernel design system (`docs/kernel/design-tokens.md` §9): Inter,
   gradient sidebar, `bg-slate-100`, kernel badge buckets — in every portal, even where older
   screens still carry Sora/Manrope.
2. Shared prototype behaviour lives in `slice1-kit.js` (namespaced `S1`): state switcher for the
   six required states, Toast, ConfirmDialog, notification Drawer with unread count, background-job
   chip, session-timeout warning, signed-out banner. Only its top `S1_CONFIG` block differs per portal.
3. **Slice 1 mode** (Prototype menu, the Slice 1 Index page, or `?s1=1`) hides nav links that are
   not slice 1 screens and every element marked `data-s1-later`, and points Dashboard / `data-s1-home`
   links at the slice 1 placeholder dashboard. Later-slice content is tagged, not deleted. Only
   content wrong for the whole MVP was removed (data-access audit tiles, keep-me-signed-in, SSO,
   invite-with-roles, non-kernel status words).
4. `scripts/check-flow.mjs` treats the activation-email landing and the Slice 1 Index as entry
   points (they are reached from an email and as the demo start, not by a link).

**Consequences:** The full-product flow is unchanged; the slice 1 demo is one toggle away. Older
agency/client screens look different from the new kernel-styled ones until they are rebuilt.

## 2026-10-10 — Slice 2: the users page redrawn in the slice 1 shell

**Context:** The slice 1 users page kept the older shell (gray ramp, static rows, role titles in copy) and was not laid out for 375 px. Slice 2 adds the Scope column, picker and Change email to it.

**Decision:** Rebuild the page from the Abstract slice 1 users page pattern in the kernel system rather than patch the old shell, keeping Users and Roles tabs and the settings tab strip the TSD gives the client (Users · Roles · Permissions · Business units · Notification preferences).

**Consequences:** The old markup is gone; the page carries its states behind the Prototype menu at both widths.

## 2026-10-11 — Two-step verification: one page for set-up and backup codes, three steps, no self-service way off

**Context:** Slice 1 brief A9–A12 left the arrangement of the enrolment steps, the handling of backup codes and the recovery wording to the designer. The contract (TSD §3.1.13) fixes the rest: TOTP only, ten backup codes shown once, no trusted devices, no switching off, a reset that only Abstract can perform.

**Decision:** (1) `/{portal}/account/two-factor` is one page in the shell, not a dialog: off, set-up and on are states of the same page, so the required-by-policy landing and the My account link arrive at the same place. (2) Set-up is three steps, not the brief's four: scanning the code and confirming it share a screen, because the person looks from phone to screen once and the key for manual entry sits beside the field it feeds. (3) Backup codes are never listed again; the page offers only *Create new codes*, behind the password and a warning that the old set stops working. Copy, download and print are all offered. (4) When the policy requires it and the person has not set it up, the shell keeps its frame but offers no navigation, since every other route returns here. (5) The sign-in step is a single field with a link to switch to a backup code; a page for the ended step (`AUTH_TWO_FACTOR_CHALLENGE_EXPIRED`) was added from the error registry, though the brief does not list it. (6) On Users, two-step status is a second line under the status badge, not a column, so the table still fits at 1024 px; client and agency lists show the status and no action. (7) User-facing copy says *two-step verification*, following the TSD's quoted strings.

**Consequences:** A person who changes phone must ask Abstract for a reset, and the page says so before they turn it on. The QR codes are static SVG for a demo secret, so the pages need no extra library. The prototype remembers "on" per browser, which makes the TV-13 walk (set up, sign out, sign in with a code) demonstrable end to end.
