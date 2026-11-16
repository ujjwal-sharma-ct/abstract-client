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

## 2026-10-11 — Two-step reset: the organisation's own administrators first, never your own, two confirmations

**Context:** The screens delivered for slice 1 brief A12 gave the reset to Abstract alone, as the TSD then said. On 2026-10-11 Ujjwal Sharma ruled the four points those screens left open (slice 1 TSD R-39).

**Decision:** (1) A holder of *Reset two-step verification* resets a user of their own organisation; Abstract resets from the administering context when nobody there can. The action is on all three Users pages. (2) It is never on the signed-in person's own row: a reset always takes a second person, so it cannot become a way of switching two-step verification off for yourself. (3) The confirmation says what follows by the organisation's policy: set up again at next sign-in where it is required, off until turned on where it is not. The prototype shows one organisation of each kind. (4) The recovery copy sends a person to an administrator at their own organisation, who asks Abstract if they cannot. (5) No enrolment date and no count of unused backup codes is shown.

**Consequences:** A sole administrator who is locked out, or who changes phone, needs Abstract. The earlier decision entry of the same date ("no self-service way off") stands; its sentence that a person who changes phone must ask Abstract now reads "an administrator at their organisation, or Abstract".

## 2026-10-11 — User detail: the row's actions on a page of their own; Forgot password shows its confirmation

**Context:** The slice 1 TSD has the route `/{portal}/settings/users/:id` and a *User detail* UI-state row (§3.3.11, §5.9), and no portal had the page; Ujjwal Sharma ruled on 2026-10-11 to draw it. The same day's batch added the reset-request page where it was missing (TSD §5.8, 1.8 TV-3).

**Decision:** (1) The detail page is the Users page's shell, dialogs and action code with the list swapped for one person, so its actions are the row's actions by construction: same labels, same order, same confirmations, same last-administrator refusal. They sit in one *Actions* card, beside the record on a wide screen and directly under the name on a phone. (2) Two-step status is a card of its own that says on, off or not set up, and what a reset leads to under the organisation's policy; no enrolment date and no count of backup codes (R-39). On your own record there is no reset, and the card says why. (3) Out of scope is a 404 inside the shell whose copy never says whether the person exists. (4) Slice 2's parts (Scope, *Set scope*, *Change email*, a pending email change) are marked `data-s1-later` or left out by the action list in *Slice 1 only*. (5) The row's name is the link; generated rows in the *Large data* state and a person invited a moment ago are plain text, because the prototype has no record for them. (6) Forgot password stops on its confirmation, which is the state TV-3 tests, and offers the emailed-link hop as a marked *Prototype only* link instead of walking it after a second.

**Consequences:** A change to a row action must be made on both pages. An `Invited` user has no email correction on the detail page because the row has none; the TSD lists one for both (open point in `PROGRESS.md`).

## 2026-10-11 — One set of role names, one signed-in person, and slice 2 parts that follow the mode

**Context:** Checking the day's first batch showed five things that were already wrong: slice 2 parts visible in *Slice 1 only*, role names that differed between Users and the matrix, permission counts that differed between portals, older pages signed in as a different person described by a role title, and no email correction for an `Invited` user although the TSD lists one. Ujjwal Sharma ruled each on 2026-10-11.

**Decision:** (1) Sample roles carry the TSD's seed names (§3.3.4) plus one custom role per party, with one set of ids across Users, User detail and the matrix. (2) Abstract's view of a party's roles and keys is a copy of that party's own matrix; no matrix was redrawn onto the TSD's key list. (3) The older full-product pages show the same signed-in person as the slice 1 pages, with her organisation under her name. (4) A static slice 2 part carries `data-s1-later`; a part drawn by script asks the mode when it draws and is redrawn on the kit's `s1:mode` event, because the kit hides marked elements only at the moment the mode is applied. (5) *Correct email* is its own action and dialog for an `Invited` user, separate from slice 2's *Change email* for an `Active` user: a correction takes effect at once and sends a new activation link, a change waits for the person to confirm it.

**Consequences:** The prototype's key lists still differ from the TSD's twelve slice 1 keys per party; that is a contract gap for a later pass, recorded in `PROGRESS.md`.

## 2026-11-08 — Slice 4: Timesheets in the slice 3 pages' sidebar; no return to Draft for the client (pending Ujjwal's review)

**Context:** Slice 4 TSD §3.3.11 puts *Timesheets* in the client `menu` group behind `timesheet:view`. Ruling 5 of
2026-11-08: the client never returns a week; only Abstract returns or reopens.

**Decision:** The five slice 3 pages gain *Timesheets* after *Bookings*. The client grid and booking-week have no
return action; a returned week shows who returned it (*Abstract*) and the reason. The grid is the same
implementation as Abstract's, from `slice4-proto.js`, whose client copy holds charge figures only. Logged in
`../SLICE-4-DECISIONS-FOR-REVIEW.md`.

**Consequences:** The old export's *Return to Draft* is gone.

## 2026-11-08 — Slice 4: a future Holiday, and the slice 4 rows on earlier pages (ruled by Ujjwal Sharma)

**Context:** The overnight pass left three questions. Ujjwal ruled them on the morning of 2026-11-08.

**Decision:** (1) A covered day keeps the place's required checks. (2) *Fill week* leaves a future day blank. (3) A
future day may be `Not Booked` or `Holiday`; `Worked`, `Sick Leave` and `No-show` wait until the day — a departure
from TSD Q4 ("no `Worked` or absence day after today"). (4) The slice 4 changes to earlier pages are drawn: the
permission matrix rows (§3.3.6), the timesheet templates (§3.1.6, Abstract) and the preference rows, with
`timesheet.pricing_pending` critical, ticked and locked. Drawn by script, they ask the mode and redraw on `s1:mode`
(as 2026-10-11 item 4), so slices 1 to 3 read as delivered.

**Consequences:** The TSD owes the future-Holiday change (§1, §3.3.1 rule 3, the `TIMESHEET_DAY_IN_FUTURE` row, 4.1
TV-4). The rule lives once, in `FUTURE_OK` in the `slice4-proto.js` source.

## 2026-11-08 — Slice 4: the design review's screen fixes (R1)

**Context:** A fresh-context review of the slice 4 pass (project-docs `review/slices/SLICE-4-DESIGN-REVIEW-R1-RECORD.md`)
found two blockers and several should-fix screen findings. Ujjwal Sharma ruled (D4) that the pass fixes the screens in
its own PR, and ruled D2 (the pricing notice is two event types) and D3 (a first-week copy is `skipped`).

**Decision:** The fixes follow the ruled TSD at `aa6861b`: the Security tab drops the admin IP allow-list from slice 4
mode on; *Copy previous week* copies `Worked` days only and skips a booking's first week; the pricing notice is two
templates, `timesheet.pricing_pending` (Abstract) and `timesheet.pricing_pending_client` (the client), each party's
locked preference row its own; notification severity is a dot and icon, never a badge (design-tokens §5); the
Abstract grid gains *Reopen* and *Price by hand*; pages without the breakdown grant leave worker pay out of the markup;
the missing six-state cases are drawn. Two states on read-mostly pages were given a meaning: Payroll's *validation* is a
week range (the API's `from` / `to`), the pay statement's is a malformed link. The bulk confirm compares a preview token
(a digest of the week's `updatedAt` and the days it would write), as the TSD's token does.

**Consequences:** The delivery notes' *Design review R1 — the screen fixes* lists each finding and what changed. The
client copy of `slice4-proto.js` reads whether Abstract bears a paid day off (so it charges 0.00) without carrying a
cost-bearer field.

## 2026-11-08 — Slice 4: the screen fixes' own decisions, ruled (Ujjwal Sharma)

**Context:** The R1 screen fixes took five small decisions. Ujjwal Sharma ruled them on 2026-11-08 (spec side on
`tsd/slice-4` at `4cf0e90`).

**Decision:** Approved as drawn: Payroll's *From week* / *To week* validation; the pay statement's malformed link; the
hidden allow-list key's page answering "We couldn't find that setting"; the client's pricing notice. Changed: a
first-week *Copy previous week* reads *Skipped*, keyed on the API's `skipReason: "no_previous_week"` (present only on
that result), never on the page re-deriving the first-week rule; any other skipped row still reads *Kept*, so the fill
outcomes are *Filled* / *Kept* / *Skipped* / *Refused*. Abstract's own notice (`timesheet.pricing_pending`, not in this portal) is titled "No
rate for a worked day: week held until priced" in-app, and its email subject is "No rate for {{candidateName}}'s
{{date}} at {{clientName}}: set a price to release the week"; the bodies are unchanged. The manual-price action reads
*Set a price* everywhere: the grid's *Set a price for <day>…*, the queue's *Set a price*, the dialog's *Set a price for
<day>*.

**Consequences:** The TSD's prose "priced by hand" stays; it is not screen copy. The permission's own label
(*Price days by hand*) and the *priced by hand* source note on a day are unchanged.

## 2026-11-12 — The original look comes back; design passes restyle, never redraw (ruled by Ujjwal Sharma)

**Context:** The slice 3 pass (2026-11-01; admin `97fa751`, client `dc335d1`) and the slice 4 pass (2026-11-08; admin
`1c629d9`, client `d88a0b6`) rewrote twelve screens from scratch instead of building on them — admin Booking Detail,
Vacancy List, Vacancy Detail, Create Vacancy, Fill Position, Worker Pool, Worker Profile and Timesheets; client
Bookings, Vacancies, Vacancy Detail and Timesheets — each losing 400 to 1,400 lines. Their look went with them: the
time-of-day shift backgrounds on the timesheet grids, the dark grid header, Booking Detail's placement-terms card and
margin composition bar, and more. The briefs' "build from the kernel" and "absent, not disabled" were read as licence to
redraw; design-tokens §6 draws a `Worked` day as a white cell while DESIGN-SPEC-v4 §6.5 says a role-changed cell "keeps
its shift background", and the conflict was not raised. It broke this log's 2026-09-26 rule (later-slice content is
tagged, not deleted), was not in either pass's decisions for review, and reached `main` (PRs #1–#3). The agency portal,
untouched by both passes, kept the original look.

**Decision:** (1) The original look goes back onto the rebuilt screens and every behaviour slices 3 and 4 added stays.
(2) All twelve screens, timesheets first. (3) The kernel's day-cell rule is amended so a `Worked` day takes its Shift's
time-of-day background (morning sky, afternoon sun, night sky with a moon); the amendment is drafted in project-docs for
approval. (4) `AGENTS.md` gains *Keep the existing look*: a pass restyles and never redraws, hides later-slice parts
instead of deleting them, and lists any big removal with before/after screenshots for approval.

**Consequences:** `slice4-proto.js` (both copies) draws a `Worked` cell in its Shift's look, keyed on the Shift's start
time (05:00–11:59 morning, 12:00–17:59 afternoon, otherwise night), adds the three Shifts to the legend and restores the
dark *Weekly day-status grid* header on the week grid and the booking-week. A cell pending manual pricing, or flagged in
error, keeps its kernel treatment. The pre-pass originals are the reference for the remaining screens: `35e14e7` (admin)
and `dc335d1^` (client) for the slice 3 pages, `97fa751` / `dc335d1` for the timesheets.

## 2026-11-13 — Four rulings from the design audit (Ujjwal Sharma)

Context: after the original look came back, an audit checked every design page against the slice 1–4 briefs, TSDs and rulings records. Four items had sources that disagreed and went to Ujjwal.

1. **"How this vacancy is worked" (client).** Clients never see this note. It is removed from the client portal, overriding slice 3 brief C9.
2. **"Released to Agencies" in the client vacancy status filter.** Hidden until agency release exists: `later(4)`, absent in every slice mode.
3. **Admin IP allow-list on System settings (SYS-010, TSD 1 TV-12).** Hidden on every screen, the full-product view included, until it is enforced (confirmed by Ujjwal in the project-docs session, 2026-11-13). The markup stays in `abstract.configuration.system-settings.html` with `hidden`.
4. **Client timesheet filters.** Week and status only, as TSD 4 §3.3.11 says. No compliance filter for clients, setting aside the overnight decision that allowed one.

## 2026-11-13 — Rulings from the design audit, second batch (Ujjwal Sharma)

Context: the second fix round (helpers working from the brief-side audit and the project-docs session's built-side gap list) left items where the design, the TSD and the build disagreed.

1. **Abstract's override reason on client screens.** The client sees the *overridden* marker only, never the reason text (TSD 4 contract). The reason stays on Abstract's screens. Client `slice4-proto.js`: the cell tooltip reads "Overridden by Abstract"; the day dialog names who overrode, not why.
2. **Pay statement markers *priced by hand* and *covered*.** Full-product view only; not in any slice 1–4 contract.
3. **Client vacancy list layout.** Keeps the restored original layout (View/Edit per row, job role under the reference). The frontend takes it in the restyle after slice 4.
4. **Client publish confirm.** Client wording in the design; the built client form's Abstract wording ("…worker pool or by a manual fill") is a frontend fix.
5. **Label "Margin"**, not "Gross margin", on vacancy and booking pages (built glossary term; ruled in the project-docs session).
6. **Backup codes.** *Copy codes* and *I've saved these* only, as built; Download and Print are dropped on all three portals' two-step pages (ruled in the project-docs session).
7. **K57 approved** (ruled in the project-docs session): a Worked cell takes its Shift's time-of-day look. The compliance icon on the morning and afternoon looks is amber-700, not amber-600, because amber-600 is below 3:1 on those backgrounds.
8. **Sample roles (R-36), DR-S12.** The sample keeps Abstract Operations *without* `user:create_edit`, one grant short of the R-36 seed, so the last-administrator refusal stays demonstrable: with a second role able to manage users, "you can't remove the last administrator" could never be reached. The built seed follows R-36; this is a deliberate prototype difference.
9. **User erasure "retention obligation" refusal, DR-S13.** Full-product view only. No slice mode shows it: the product has no such refusal for a user, only a candidate's legal hold (`abstract.identity-access.data-subject-requests.html`).

The project-docs session records these as DR-S11 to DR-S13 in `delivery/design-restore/PLAN.md` §2.

## 2026-11-15 — Slice 5 design pass, client portal (design calls; for Ujjwal Sharma's review)

Context: the slice 5 brief Part B and TSD 5.7; the pass brief's *Keep the existing look* rules. Calls taken on the recommended option:

1. **Proposals on Vacancy Detail** keep the original *Candidate proposals* cards (tinted initials, *Proposed by*, badges, the vacancy's charge rate); the old placeholder's Accept/Reject buttons become one *Review* button, because the TSD puts the decision on Proposal Review. The status badge is the kernel's ProposalStatusBadge; the compliance badge keeps the card's shield look.
2. **Proposal Review (client)** is a new page in Vacancy Detail's look (title row with avatar and badge, white cards, the *Vacancy details* panel with the highlighted charge rate). Accepting opens the new booking (TV-2). The dialog says *supplied by <party>*, never a source word.
3. **Candidate Directory** keeps its own (older, Sora/Manrope, navy) look: its static rows and footer stay in the file, hidden by script; the business-unit filter and the header's global search are `data-s5-later` (not slice 5's), *Not Applicable* leaves the compliance filter (not a roll-up value), *View Status* is `data-s5-later` (no candidate detail page, Q12). Its sidebar keeps the *Recruitment › Candidate Directory* item; the slice pages' flat sidebars gain *Candidates* after *Timesheets*.
4. **Supplying party on Bookings**: every row reads *Supplied by …* under the candidate in s5 and full (Abstract, the agency's name, or *Agency*).
5. **Override on a client week**: the day table and the day dialog read *Overridden by Abstract* only (slice 4 DR-S6; it read the author and the reason in the day table before).
6. **Pool candidates' compliance and licences** in the directory are copied, as open facts, from the Abstract portal's slice 3 records into the client's `slice5-proto.js` (the client copy holds no other candidate field).


## 2026-11-16 — Requirement IDs stripped from the earlier slices' pages too (ruled by Ujjwal Sharma)

No requirement ID in copy a user reads — text, tooltips (`title`), toasts
and dialog bodies drawn by script. A trailing *(XX-NNN)* goes with its space; a leading *XX-NNN ·* label goes and
the rest is capitalised (*SYS-007 · effective-dated* → *Effective-dated*). Code comments keep their IDs, and so do
the slice design hubs (reviewer pages). Nothing else in the copy changed.

## 2026-11-16 — Slice 5 sample data; no Not Requested badge (ruled by Ujjwal Sharma)

1. **VAC-1050 *Goods-in operatives*** (Leicester DC, three open positions, created and published by Rachel Green on
   6 Oct) is new slice 5 sample data, released to an agency on 9 Oct, so Vacancies lists it under *Released to
   Agencies*. It is in `slice3-proto.js` flagged `s5only`: it reads only in the slice 5 mode and the full product.
2. **No *Not Requested* badge in the day table.** An Agency-sourced absence whose confirmation was never requested shows
   no badge, only the *Request agency confirmation* link where it is offered (the same rule as Abstract's).
   *Requested (awaiting agency)* and *Justified* keep theirs.
3. The shared `slice5-proto.js` copy is rebuilt from the source; nothing of the third Acme agency Abstract added
   (Calder Recruitment) or of the agency pay figures is in this copy.

## 2026-11-16 — Slice 5 TSD review R5: the rulings applied to the client's pages (ruled by Ujjwal Sharma)

From the slice 5 TSD review R5 (project-docs `review/slices/SLICE-5-TSD-REVIEW-R5-RECORD.md`); `slice5-proto.js` rebuilt
from the source in the Abstract repo.

1. **R5-D6 — "Awaiting agency".** A requested day's pill, legend entry, cell mark tooltip and aria text read
   design-tokens §6's *Awaiting agency*, not *Requested (awaiting agency)*. *Justified* stays.
2. **R5-D9 — The absence modal sends the tick only if it changed.** `requestConfirmation` is sent only when the user
   changes the tick from its default (the client's setting), so an untouched default records party `policy`, read as
   *Requested automatically (client setting)*.
3. **R5-G1 — No proposal reference on a booking.** Booking Detail's *From proposal* row is gone. The Bookings list
   never showed one. Proposal pages keep their PRP ids.
4. **R5-P1 — Candidate Directory's menu.** The directory keeps its own look, but its sidebar now lists the slice pages'
   items in their order and words: Dashboard, Vacancies, Bookings, Timesheets, *Candidates*, Business Units, Users &
   Permissions, Notification preferences (then Invoices and Reports, full product only). Replaces call 3's
   *Recruitment › Candidate Directory* item (2026-11-15).
