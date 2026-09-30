# Loyalty Offer Manager: Clickable Prototype Build Spec

**Version:** 1.0 (30 Sep 2026)
**Owner:** Jay (Mrityunjay Misra), Technical PM, AIML / CDT
**Audience:** Claude Code (builder) and the PM reviewing the build
**Purpose:** Build a front-end-only, clickable prototype of the Loyalty Offer Calendar digitization product. Business stakeholders use it to confirm the end-to-end flow, the fields, the dropdown values and the field definitions before engineering starts.

---

## 0. Instructions for Claude Code (read first)

1. Read this whole document and every file in `/data` before writing code.
2. This is a **prototype**: no backend, no real authentication, no real Databricks connection. All data is hardcoded from the JSON files in `/data`. Persist edits in `localStorage` so the demo survives a page refresh, and provide a "Reset demo data" action.
3. Every field, dropdown value and tooltip must come from `/data`. **Do not invent fields, options or definitions.** If something seems missing, leave a visible `TODO` badge in the UI rather than making it up.
4. Where this spec marks a rule as **(proposed rule)**, implement it but show a small "Proposed rule" info icon in the UI so the business knows it still needs confirmation.
5. Anything marked **Phase 2** must be visible (so the business sees the roadmap) but clearly badged "Phase 2" and non-functional or mocked.
6. Build in the order in section 13 (Build plan). After each milestone, run the app and check it against the acceptance checklist in section 14.
7. Keep all copy plain and business-friendly. No lorem ipsum anywhere.

---

## 1. What the prototype must demonstrate

The business should be able to watch, or click through, this story end to end:

1. An Offer team member opens the offer list, filters it, and starts a **new offer**.
2. They move through a **9-step guided form** (Request & Timing through Results), with dropdowns, automatic calculations, fields that appear only when relevant, and a tooltip on every field taken from the data dictionary.
3. They **save a draft**, leave, return, and see **autosave** has kept their work.
4. They **submit** the offer. It enters the lifecycle as **Proposed**.
5. An approver **approves the offer and its forecast**, and it moves to **Planning Phase**.
6. The team works through the **build checklist** (submission form, SKU list, submitted to Kognitiv, offer card, audit, secondary audit) and moves the offer through **Approved / Build Phase**, **Pending MD** and **Audited / Ready to go** to **Live**.
7. After the offer ends they enter **results**. The app calculates bonus rate, bonused sales and redeemable dollars, and updates the **WBR (weekly business review)** view.
8. They mark it **Completed - Data Final**.
9. Along the way: they **copy** an offer, **cancel** an offer (with reason), view the **change history**, set up a **grouped offer** with daily child promotions, and see how the record flows to **Databricks** (simulated), including a simulated failed load that leaves existing data intact.
10. The business owner (Admin) edits a **reference list** (e.g. adds a sub-category) and it appears in the dropdown immediately.

---

## 2. Tech stack and project structure

| Item | Choice |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Components | Headless UI or Radix primitives (Dialog, Popover, Tooltip, Combobox, Tabs, DropdownMenu) |
| State | Zustand store with `persist` middleware (localStorage key `lom-prototype-v1`) |
| Routing | React Router |
| Tables | TanStack Table (sorting, filtering, column visibility, row selection) |
| Dates | date-fns |
| Icons | lucide-react |
| Export | Client-side CSV generation (no library needed) |

```
/data                      <- provided JSON (copy into src/data)
  fields.json              129 field definitions (one per Excel column)
  dropdowns.json           all dropdown option lists
  reference.json           tiers, categories, lifecycle, soft lock, fiscal calendar, evergreen, etc.
  metadataFields.json      169 Databricks metadata fields and their mapping
  sampleOffers.json        21 real offers from the calendar (seed data)
/src
  /data                    (copies of the above)
  /lib
    calculations.ts        every formula in section 8
    validation.ts          rules in section 9
    visibility.ts          show/hide rules in section 10
    lifecycle.ts           statuses, transitions, guards in section 7
    format.ts              number, currency, percent, date, WBR string formatters
    csv.ts
  /store
    useAppStore.ts         offers, audit log, reference lists, current role, saved views, feed log
  /components
    AppShell, RoleSwitcher, FieldRenderer, FieldTooltip, StepNav, LifecycleBar,
    ChecklistPanel, ValidationSummary, HistoryDrawer, PhaseBadge, ProposedRuleIcon,
    ConfirmDialog, Toasts, EmptyState
  /pages
    OffersList, OfferWorkspace, ApprovalsQueue, WbrView, ReferenceAdmin,
    EvergreenOffers, DataDictionary, DataFeedPreview, Phase2Calendar, NotFound
```

---

## 3. Visual design

Utilitarian internal tool: clean, dense, easy to scan. Do not use any company logo; use a text wordmark "Loyalty Offer Manager" with a small "Prototype" pill.

| Token | Value | Use |
|---|---|---|
| Primary | `#2C6E76` (teal) | Primary buttons, active nav, links |
| Accent | `#B5651D` (amber brown) | Step numbers, highlights, Phase 2 badge border |
| Ink | `#1E2229` | Body text |
| Muted | `#6B7280` | Helper text |
| Border | `#E5E1D8` | Inputs, cards |
| Surface | `#FAF9F6` | Page background |
| Success | `#3D7A4E` | Completed, valid |
| Warning | `#A5761E` | Warnings, Pending statuses |
| Danger | `#B8452F` | Errors, Cancelled |

- Font: Inter or system UI, 14px base, tabular numbers in tables.
- Status pills use a consistent colour per status (section 7.2).
- Computed fields render as read-only with a light grey fill and a calculator icon; hovering shows the formula.
- Required fields show a red asterisk. N/A-capable fields show a small "N/A" toggle next to the input.
- Every field label has an info icon (i). Hover or focus shows the tooltip (section 11.3).
- Layout must work from 1280px wide upward (desktop tool); below that the step nav collapses to a dropdown.

---

## 4. Data files: what each contains and how to use it

### 4.1 `fields.json` (129 entries, one per column of the Calendar main tab)

| Key | Meaning |
|---|---|
| `id` | camelCase field id used everywhere in code and in `sampleOffers.json` |
| `label` | Label to show in the UI |
| `excelColumn`, `excelHeader` | Where the field lives in today's spreadsheet (show in the Data Dictionary page and in tooltips as "Today: column X") |
| `step` | Which form step shows the field. `System (hidden)` fields are not shown in the form |
| `control` | `text`, `textarea`, `number`, `currency`, `percent`, `date`, `dateOrNA`, `url`, `select`, `combobox`, `yesno`, `computed`, `hidden` |
| `optionsKey` | Key into `dropdowns.json` for select / combobox / yesno |
| `tooltip`, `tooltipSource` | Tooltip text and where it came from. If `tooltipSource` starts with `DRAFT`, show a small "Draft definition" tag inside the tooltip |
| `required` | Required to submit the offer (Proposed) |
| `allowNA` | Field accepts the literal value `N/A` (very common in today's data) |
| `showIf` | Human-readable visibility rule (implemented in section 10) |
| `dependsOn` | Parent field for cascading dropdowns |
| `computed` | Human-readable formula (implemented in section 8) |
| `validate` | Human-readable validation (implemented in section 9) |
| `readOnlyInForm` | Field shown but changed only via lifecycle actions |
| `checklist` | Part of the build checklist |
| `group` | Sub-group heading inside a step (e.g. "Pet type", "Merchandise type") |
| `phase` | `Phase 2` where applicable |
| `datalakeColumn`, `metadataType`, `datatype` | Databricks column, MA (attribute) or CM (calculated metric), and datatype, when the field feeds the metadata table |
| `excelEntryType`, `excelSection`, `excelGroup`, `excelNote`, `sampleValue` | Context from the spreadsheet for the Data Dictionary page |
| `note` | Builder note: implement exactly as described |

### 4.2 `dropdowns.json`

Every dropdown list. Keys used by `optionsKey`. The largest lists are `brands` (2,758 values) and `transactionTypes` (454 values): render these as **searchable comboboxes**, never plain selects. Keys that start with `_unusedInMainTab_` exist in the spreadsheet's list tab but no main-tab field uses them; show them only on the Reference Admin page.

### 4.3 `reference.json`

| Key | Contents | Used by |
|---|---|---|
| `tieringDefinitions`, `tieringNote` | Tier letters A, B, C, C+, D, D+, R, Exclude with descriptions and examples; note that CAN-only offers use CAN-suffixed tiers | Offer tiering tooltip and side panel |
| `categorySubCategory` | 49 valid Category to Sub-Category pairs with examples and a "new" flag | Cascading Sub-Category dropdown |
| `offerSetupCombos` | 22 known combinations of Offer Design, Kognitiv Activation Setup Type, Kognitiv Offer Setup Type and Opt-In Method | "Common setups for this design" helper in step 5 |
| `deactivationRules` | Deactivation code nomenclature (MMYYD#K#) | Deactivation Code tooltip and format check |
| `lifecycle` | The 12 statuses in the Status dropdown, with definitions where documented | Lifecycle bar |
| `transactionTypeIndex` | Public name, activity bucket and when to use | Transaction type combobox helper |
| `transactionTypes` | Full transaction type reference table (454 rows) | Transaction type comboboxes, Reference Admin |
| `softLockPlanner` | Planner month, planner start/end, soft lock date | Reference Admin (editable) |
| `softLockByStartDate` | Start date to soft lock date (2025-11-01 to 2028-01-30) | Soft Lock Date calculation |
| `fiscalCalendar` | Date to fiscal week, month and year (2021-02-01 to 2029-01-28) | Fiscal Week calculation |
| `evergreenOffers` | Always-on offers | Evergreen Offers page |
| `loyaltyUseOnlyChecklist` | Today's checklist column names | Checklist panel labels |
| `inspireSubmissionForms` | MFP and RA submission form templates: calendar field, Kognitiv field, example, guide, mapped `calendarFieldId` | Phase 2 "Generate submission form" preview |
| `constants` | 10 base points per $1; 1,000 points = $2; redemption rate rule | Forecast and results calculations |
| `groupedChildrenSamples` | Child promotions for 7 real grouped offers | Grouped Offer tab seed data |

### 4.4 `metadataFields.json` (169 entries)

The Databricks metadata columns: `sourceColumn`, `datalakeColumn`, `type` (MA = metadata attribute, CM = calculated metric), `includeInDatalake`, `datatype`, `description`, and `calendarFieldId` (the form field or `calc.*` key that fills it, or null if not captured in the calendar). Used by the Data Feed Preview page.

### 4.5 `sampleOffers.json` (21 offers)

Real offers from the live calendar, chosen to cover every status that exists in the data, grouped offers, Canada-only, US-only, limited time bonus, points donations, targeted with member descriptor, grand opening, JBP brand, and offers with complete forecast and results. Each object has every field id plus `_sampleReason`. Load these as the initial offers. Values of `"N/A"` are real and must display as N/A.

---

## 5. Roles and permissions (demo role switcher)

A role switcher sits in the top bar ("Viewing as: ..."). Switching role changes what buttons are enabled. There is no login.

| Capability | Offer Team Editor | Loyalty & Pricing | Approver (TBC) | View-only | Admin (business owner) |
|---|---|---|---|---|---|
| View offers, WBR, data dictionary | Yes | Yes | Yes | Yes | Yes |
| Create, edit, copy offers | Yes | Yes (proposed rule) | No | No | Yes |
| Delete draft offers | Yes (own drafts) | No | No | No | Yes |
| Cancel an offer | Yes | No | No | No | Yes |
| Change status (non-approval steps) | Yes | No | No | No | Yes |
| Approve offer and forecast | No | No | Yes | No | Yes |
| Edit build checklist | Yes | No | No | No | Yes |
| Enter results | Yes | No | No | No | Yes |
| Edit reference lists | No | No | No | No | Yes |
| Save personal views, export CSV | Yes | Yes | Yes | Yes | Yes |
| Data feed preview and simulations | View | View | View | View | Yes (run simulations) |

Notes:
- Who approves offers is an open question. Label the role "Approver (TBC)" and show an info icon: "Who approves offers is not yet confirmed (steering committee?)."
- Disabled actions stay visible with a tooltip explaining which role can do them.

---

## 6. Navigation and screens

Left sidebar:

1. **Offers** (home list)
2. **Approvals** (badge with count of offers awaiting approval)
3. **WBR** (weekly business review: forecast vs actuals)
4. **Evergreen offers**
5. **Reference data** (Admin only; others see read-only)
6. **Data dictionary**
7. **Data feed (Databricks)**
8. **Calendar view** (Phase 2 badge)

Top bar: wordmark and Prototype pill, global search (offer name or ID), role switcher, "Reset demo data", help (opens the demo script from section 12 in a drawer).

---

## 7. Screen specifications

### 7.1 Offers list (home)

**Purpose:** Replace scrolling the spreadsheet. One searchable, filterable grid of all offers.

**Header row**
- Title "Offers" and count.
- Buttons: **New offer** (primary), **Copy offer** (enabled when 1 row selected), **Export CSV** (selected rows or all filtered rows), **Columns** (show/hide), **Save view**.

**Status summary chips** (clickable filters): one chip per status with count, in lifecycle order (section 7.2), plus "Drafts".

**Filters bar**
- Search (Offer Name, Offer ID, Activation Descriptor).
- Status (multi-select), Planning month (from Start Date, MMM YYYY), Category, Sub-Category, Country, Offer tiering, Offer Design, P&P Contact, Grouped (Yes/No), "Starts in next 30 days", "Past soft lock and not Audited".
- "Clear filters". Saved views dropdown (per role, localStorage). Saving a view never changes other users' views.

**Default columns** (all sortable):
Offer ID, Offer Name (link to workspace), Status (pill), Start Date, End Date, # of Days, Soft Lock Date (red text if past and status earlier than Audited / Ready to go), Country, Category, Sub-Category, Tier, Offer Design, Channel, P&P Contact, Checklist (e.g. "4 / 6" progress bar; the 6 items are Submission Form Made, SKU List, Offer Submitted to Kognitiv, Offer Card Built in Contentful, Offer Audited, Secondary Audit; an item counts as done when Yes, Partially or N/A), Forecast Status, Grouped (icon), Last updated.

**Optional columns:** any other field from `fields.json` via the Columns menu.

**Row actions (kebab menu):** Open, Copy, View history, Cancel offer (role-gated), Export row.

**Empty state:** "No offers match these filters." with Clear filters button.

### 7.2 Lifecycle statuses

Use exactly the 12 statuses in `dropdowns.status` (order below), plus a prototype-only **Draft** state for offers saved but not yet submitted.

| # | Status | Definition (exact text from `reference.lifecycle`) | Pill colour |
|---|---|---|---|
| 0 | Draft (prototype only) | Saved in the application but not yet submitted | Grey outline |
| 1 | Forecast Only | Not documented; confirm with business | Grey |
| 2 | Pending SteerCo Approval | Not documented; confirm with business | Amber outline |
| 3 | Proposed | Offer added to the calendar with an initial forecast. Approval pending. SKUs are not sent to Promo Advisor in this phase. Proposed offers reviewed and approved daily. SLA is 48 hours for approval | Amber |
| 4 | Planning Phase | Approved but not yet submitted to Capillary; forecast is approved, and SKUs sent to Promo Advisor within 7 days | Blue |
| 5 | Approved / Build Phase | Offer submitted to Capillary; build in progress. | Indigo |
| 6 | Pending MD | Pending member descriptor before moving to Audited / Ready to go | Amber |
| 7 | Audited / Ready to go | Capillary build complete; offer card set up on contentful: audit complete based on 'binders and checklists' | Teal |
| 8 | Live | Offer activatable; pre-activation or point awards live | Green |
| 9 | Completed | Offer ended; data not final | Slate |
| 10 | Completed - Data Final | Reporting complete; final data pull complete minimum of 5 days after offer ends | Dark green |
| 11 | Pending Points Upload | Points upload file pending after offer ends (example: Afterpay) | Amber |
| 12 | Cancelled | Offer cancelled - row will be deleted during monthly clean up (in the product the record is kept, not deleted) | Red |

Two service levels come straight from these definitions; surface them in the UI:
- **Proposed:** "SLA is 48 hours for approval". In the Approvals queue and the offer header, show "Waiting X h"; turn amber after 24 h and red after 48 h.
- **Planning Phase:** "SKUs sent to Promo Advisor within 7 days". In Planning Phase, show a reminder chip "SKUs to Promo Advisor due <approval date + 7 days>" until SKU List = Yes.

Show the exact definition text from `reference.lifecycle` in each status tooltip. For statuses with `documented: false`, show "Definition not documented yet (confirm with business)".

### 7.3 Lifecycle bar and status actions (inside the Offer Workspace)

A horizontal stepper under the offer header showing the main path:
`Draft > Proposed > Planning Phase > Approved / Build Phase > Pending MD > Audited / Ready to go > Live > Completed > Completed - Data Final`
Side states shown as badges when active: Forecast Only, Pending SteerCo Approval, Pending Points Upload, Cancelled.

To the right: a **Change status** button (dropdown of allowed next statuses) and context buttons below. Every status change opens a confirmation dialog with an optional comment and writes to the audit log.

**Transitions and guards (proposed rules, derived from the status definitions)**

| From | To | Button label | Guard (block with message if not met) | Who |
|---|---|---|---|---|
| Draft | Proposed | Submit offer | All `required` fields valid (section 9) | Editor, Admin |
| Draft / Proposed | Forecast Only | Mark as forecast only | none | Editor, Admin |
| Proposed | Pending SteerCo Approval | Send to SteerCo | none | Editor, Admin |
| Proposed / Pending SteerCo Approval | Planning Phase | **Approve offer and forecast** | Forecast entered (Activation by day Low and High, Bonus rate Low and High) **or** Forecast needed? = No. Records approver name and timestamp | Approver, Admin |
| Proposed / Pending SteerCo Approval | Proposed | Return for changes | Comment required | Approver, Admin |
| Planning Phase | Approved / Build Phase | Mark submitted to loyalty platform | Submission Form Made = Yes and Offer Submitted to Kognitiv = Yes | Editor, Admin |
| Approved / Build Phase | Pending MD | Mark pending member descriptor | Offer is Targeted and Member Descriptor is empty or N/A | Editor, Admin |
| Approved / Build Phase or Pending MD | Audited / Ready to go | Mark audited and ready | Offer Card Built = Yes; Offer Audited = Yes or Partially; if Targeted, Member Descriptor present; SKU List = Yes or N/A | Editor, Admin |
| Audited / Ready to go | Live | Mark live | none (manual; not automatic) | Editor, Admin |
| Live | Completed | Mark completed | Today is after End Date (warn but allow override with comment) | Editor, Admin |
| Live / Completed | Pending Points Upload | Mark pending points upload | none | Editor, Admin |
| Completed / Pending Points Upload | Completed - Data Final | Mark data final | Activations, Bonused members and Bonus Pts Issued entered; today at least 5 days after End Date (warn but allow override) | Editor, Admin |
| Any except Cancelled | Cancelled | Cancel offer | Reason required; sets Date of Change / Cancel to today | Editor, Admin |
| Cancelled | previous status | Reinstate | Admin only, comment required | Admin |

Every guard failure shows a clear message listing what is missing, with links that jump to the field.

Show a **Proposed rule** info icon beside the transition table in-app (a small "?" next to "Change status") explaining: "These status rules are derived from today's status definitions and need business confirmation."

Status is **never** changed automatically by dates in this prototype.

### 7.4 Offer Workspace (create and edit)

**Route:** `/offers/new` and `/offers/:offerId`.

**Header**
- Offer Name (or "New offer"), Offer ID, status pill, Start to End dates, Country.
- Autosave indicator: "Saving...", "All changes saved 10:42", or "Unsaved changes" (drafts autosave 1 second after the last keystroke).
- Buttons: **Copy offer**, **History**, **Export**, **Cancel offer** (role-gated), overflow: **Delete draft** (drafts only).

**Lifecycle bar:** section 7.3.

**Body layout:** left step navigation, centre form, right panel.

- **Left: step navigation.** 9 steps (below) plus "Review". Each step shows a status icon: not started, in progress, complete (all required valid), or has errors (red dot with count). Clicking any step jumps there (non-linear); Next and Back move in order.
- **Centre: form** for the current step. Fields render with `FieldRenderer` by `control` type. Sub-groups (field `group`) render as titled fieldsets. Computed fields render read-only inline with a calculator icon.
- **Right panel (collapsible), context-sensitive:**
  - Step 1: Soft lock and fiscal info card (Fiscal Week, Soft Lock Date, days until soft lock, planning month).
  - Step 2: Tier definitions (from `reference.tieringDefinitions`); valid sub-categories for the chosen category.
  - Step 5: "Common setups for this Offer Design" list from `reference.offerSetupCombos`; clicking one fills Activation Setup Type, Offer Setup Type and Opt-In Method (user can still change them).
  - Step 7: live forecast summary (section 8.3).
  - Step 8: checklist progress and what the next status needs.
  - Step 9: live results summary and WBR strings (section 8.4, 8.5).
  - Always available tab: **Validation** (all errors and warnings across steps, each clickable).

**Footer (sticky):** Back | Save draft | Next. On the Review step: **Submit offer** (Draft only) or **Save changes** (existing offers). Keyboard: Ctrl/Cmd+S saves.

**Leaving with unsaved changes** (non-draft offers): confirm dialog "Discard changes?".

#### Steps and their fields

The complete field list per step, with control types, options, rules and tooltips, is in **Appendix A**. Summary:

| Step | Purpose | Key fields |
|---|---|---|
| 1. Request & Timing | Who asked, when, and the offer dates | Offer ID, Offer Request Date, Submitted By, P&P Contact, Start, End, Early Activation; computed Start Month, Fiscal Week, Soft Lock Date, # of Days, planning key; Dashboard month |
| 2. Offer Basics | What the offer is | Offer Name, Category, Sub-Category (cascading), Tiering, Country, Broad vs Targeted, Channel, descriptions, Grouped Offer, Build Status (read-only) |
| 3. Reward & Rules | How members earn | Product vs Basket, Award Rule, Max QTY, Free vs Transactional, thresholds, threshold rule, Multiplier or Fixed points, LTBP dates, Points Award Date |
| 4. Audience & Merchandising | Who can get it and what it covers | Audience origination, member exclusions, member tiers, brand, proprietary brand, offset, funding, pet type flags, merchandise flags, Location Code (grand openings) |
| 5. Loyalty Platform Setup | What Kognitiv needs | Offer Design, Activation Setup Type, Offer Setup Type, Activation Required, Opt-In, Auto-activation, Post-Activation Descriptor, Deactivation Code, Interaction Type, transaction types, Member Descriptor, Internal Reward Ref, Transaction External Ref ID, Activation Descriptors (US, CAN) with character counts |
| 6. Content, Signage & SKUs | Handoffs to other teams | Disclaimers, offer card links, signage and label requests, red text, JIRA ticket, SKU List, SKU upload date, priority SKUs |
| 7. Forecast | Expected performance | Forecast date, created by, forecast needed (computed), forecast status, activation by day low/high, bonus rate low/high, spend per transaction low/high; computed totals |
| 8. Build Checklist | Production steps | Submission form, submitted to Kognitiv, offer card, audited, secondary audit, date of change/cancel, appeasement, notes |
| 9. Results | Actual performance | Results date updated, audience size, activations, bonused members, bonus points issued; LOPD actuals (Phase 2) |
| Review | Check and submit | Read-only summary by step, validation list, "Submit offer" / "Save changes" |

**Grouped Offer tab:** when Grouped Offer = Yes, a **Child promotions** tab appears beside the steps (section 7.5).

### 7.5 Grouped Offer: child promotions tab

Shown only when Grouped Offer = Yes.

- Explanation text: "One member-facing offer run as several promotions, often one per day. Members activate once; each child has its own Transaction External Ref ID and results."
- Table columns (from `reference.groupedChildrenSamples` keys): Offer Name (child), Start Date, End Date, # of Days Offer Ran, Transaction External Ref ID, Activation Descriptor (defaults to the parent's, read-only), Activations, Bonused Members, Bonus Pts Issued, Bonus Rate (computed).
- Buttons: **Add child**, **Generate daily children** (creates one child per day from Start to End, named `<parent name> - M/D`, all fields editable; this is a UX convenience, not a new rule), **Remove child**.
- Totals row: sum of activations, bonused members and bonus points; bonus rate computed from totals.
- Validation: child Transaction External Ref IDs must be unique.
- Seed: for the sample offers `20260323_TIERA_50_5000` and `20251229_CATFOODLITTER_25_5000`, load children from `reference.groupedChildrenSamples`.

### 7.6 History (audit trail) drawer

Right-side drawer listing every change to the offer, newest first: timestamp, user (role name), action (created, field changed, status changed, approved, checklist item, cancelled, copied from), field label, old value, new value, comment. Filter by action type. Seed offers start with one "Imported from Loyalty Calendar" entry.

### 7.7 Approvals queue

List of offers in Proposed or Pending SteerCo Approval. Columns: Offer ID, Name, Start Date, Soft Lock Date, Tier, Forecast summary (activations avg, bonus points avg, redeemable $ with breakage avg), Submitted By, time waiting (amber after 24 h, red after 48 h, per the 48-hour approval SLA). Row buttons: **Open**, **Approve offer and forecast**, **Return for changes** (comment required). Only Approver and Admin can act; others see read-only.

### 7.8 WBR view (Weekly business review)

Replicates today's "LIVE - Results and Forecast" WBR block.

- Filters: planning month, status, category, tier.
- Columns: Offer Name, Offer Period (`m/d-m/d`), Forecast activations (thousands), Forecast bonused members and rate, Forecast spend per bonused member, Forecast bonus points (MDs) and $, Actual activations, Actual bonused members and rate, Actual spend per bonused member, Actual bonus points and $, Actual bonused sales, % complete by days, Prorated points, **Colour code** (Pink / Light green / Dark green chip).
- All strings use the exact formatting rules in section 8.5.
- Excluded offers: Cancelled and Offer Design = IMP only (same as today's "Include for Results and Forecast?").
- Export CSV.

### 7.9 Reference data (Admin)

Tabs, each an editable table (Admin) or read-only (others). Every change is logged (audit) and is immediately available in dropdowns.

| Tab | Source | Editable columns |
|---|---|---|
| Categories and sub-categories | `reference.categorySubCategory` | Category, Sub-Category, Example, Active (new) |
| Offer tiering | `reference.tieringDefinitions` | Tier, Description, Example |
| Statuses | `reference.lifecycle` | Definition (status names read-only) |
| Dropdown lists | every key in `dropdowns.json` | Values (add, rename, deactivate; never hard-delete a value used by an offer) |
| Offer setup combinations | `reference.offerSetupCombos` | All four columns |
| Transaction types | `reference.transactionTypes` + `transactionTypeIndex` | All columns |
| Soft lock planner | `reference.softLockPlanner` | Month, Planner Start, Planner End, Soft Lock. Validate End >= Start and flag rows where the soft lock date is after the planner month (the current data has such rows; highlight them) |
| Deactivation code rules | `reference.deactivationRules` | Text |
| Brands | `dropdowns.brands` | Search, add, deactivate |

Retiring a value: offers already using it keep it and show it with a "retired" tag (proposed rule; confirm).

### 7.10 Evergreen offers

Table from `reference.evergreenOffers`: Promotion Name, Status, Description, Member Descriptor, Activation Descriptor, Start, End, Activation, Disclaimer. Admin and Editor can add or edit; status options: "Active" / "Ends <date>" / "Decommissioned". Note banner: "Always-on offers tracked separately today."

### 7.11 Data dictionary

Searchable list of all 129 fields: Label, Step, Today's Excel column and header, Control, Options (count and a "view" popover), Tooltip text, Tooltip source (flag DRAFT ones), Databricks column, MA/CM, Datatype. Filter by step, by "has draft definition", by "feeds Databricks". This page is the business's checklist for confirming definitions.

### 7.12 Data feed (Databricks) preview

**Purpose:** show that the product writes the same data downstream teams use today.

- Offer picker.
- Panel A **"Loyalty metadata record"**: table of the 169 `metadataFields`: Source column, Datalake column, Type (MA/CM), Include in datalake, Datatype, **Value** (from the offer via `calendarFieldId`: form field value, or the `calc.*` result from section 8, or "Not captured in the calendar form" if null).
- Banner showing the include rule: "Cancelled offers are excluded from the metadata feed."
- Panel B **Load log**: list of simulated loads (time, records, status).
- Buttons (Admin): **Simulate daily load** (adds a Success entry with record count = offers where Include for Metadata = Yes) and **Simulate failed load** (adds a Failed entry: "Load failed: existing table data unchanged. No blank rows written." and the Panel A values stay as they were).
- Explanatory note: "In the product this is a direct write to the existing loyalty table in Databricks. This page simulates it."

### 7.13 Phase 2 previews (badged, non-functional)

| Where | What to show |
|---|---|
| Step 7 Forecast header | Disabled button **Pre-fill from Loyalty Offer Forecast data product** with Phase 2 badge and tooltip "Confirmed for Phase 2, not MVP." |
| Step 9 Results header | Disabled button **Pull actuals from LOPD** with Phase 2 badge |
| Step 6 and offer header overflow | **Generate Inspire submission form (MFP / RA)**: opens a read-only preview modal rendering `reference.inspireSubmissionForms.MFP` (or RA) rows: Calendar field, Kognitiv field, **value from this offer** (via `calendarFieldId`), Guide. Badge: "Phase 2 preview". No download. |
| Step 6 SKU List | Link-style button **Open SKU List Uploader** (Phase 2, disabled; "Integration approach to be decided") |
| Sidebar: Calendar view | Month grid of offers by Start and End dates, coloured by status; toggle "Show overlapping offers for the same members". Badge Phase 2 on the page title |

---

## 8. Calculations (implement exactly in `lib/calculations.ts`)

All formulas below are taken from today's spreadsheet formulas. Constants come from `reference.constants`. Treat `"N/A"`, empty string and null as "no value". Never show `NaN`, `Infinity` or `#N/A`. Show "Not entered" when an input is missing and "Not available" when a lookup has no match.

### 8.1 Calendar computed fields

| Field id | Formula | Excel today |
|---|---|---|
| `startMonth` | First day of Start Date's month; display `MMM YYYY` | `=H` |
| `fiscalWeek` | `reference.fiscalCalendar[startDate].fw` (e.g. `FW39`) | XLOOKUP on Fiscal Calendar |
| `calc.fiscalMonth`, `calc.fiscalYear` | `.fm`, `.fy` from the same lookup | Metadata columns |
| `softLockDate` | `reference.softLockByStartDate[startDate]`; if not found show "Not in soft lock table" | VLOOKUP on Soft Lock Dates |
| `numberOfDays` | `endDate - startDate + 1` (days) | `=I-H+1` |
| `dueDates` | `format(startDate,'MMM') + format(startDate,'yyyy')`, e.g. `Nov2025` | INDEX/MATCH on month list |
| `categoryConcat` | `category + " - " + subCategory` | `=K&" - "&L` |
| `activationDescriptorLength` | `activationDescriptor.length` (0 if N/A) | `=LEN(BJ)` |
| `canActivationDescriptorLength` | `canActivationDescriptor.length` | `=LEN(BL)` |
| `includeForMetadata` | `"No"` if status = Cancelled, else `"Yes"` | CU |
| `includeForResultsForecast` | `"No"` if status = Cancelled or offerDesign = "IMP only", else `"Yes"` | CW |
| `startMonthNumber`, `startYear` | month number, year of Start Date | CY, CZ |
| `metadataRefNumber`, `resultsForecastRefNumber` | **Do not implement.** Excel running numbers replaced by Offer ID. Show in Data Dictionary as "Retired in product" | CV, CX |

### 8.2 Forecast inputs to totals (calendar)

| Field id | Formula |
|---|---|
| `totalOfferDays` | if `earlyActivationDate` is N/A or empty: `endDate - startDate + 1`; else `endDate - earlyActivationDate + 1` |
| `activationLow` | `activationByDayLow * totalOfferDays` |
| `activationHigh` | `activationByDayHigh * totalOfferDays` |
| `forecastNeeded` | `"No"` if offerDesign = "Activation Only - Internal Reward"; else `"Yes"` if (category in [Merch, Services, Loyalty, Digital, REDEMPTION] (case-insensitive) or (category = Benefit and subCategory = Birthday)) **and** `bonusRedeemableLow` = 0 **and** status ≠ Cancelled; else `"No"` |

Note: Excel compares category case-sensitively against "Merch", "Services", etc. while the dropdown values are upper case (MERCH, SERVICES). Implement case-insensitive and list this in section 15 as a data finding.

### 8.3 Forecast calculations (from today's Results and Forecast tab)

Let `W = bonusPointCalc`:
- if offerDesign = "Multiplier": `W = parseInt(multiplier) - 1` (e.g. "3X" gives 2)
- else `W = fixedPoints` (number)

| Calc key | Formula |
|---|---|
| `calc.activationAvg` | avg(activationLow, activationHigh) |
| `calc.bonusRateAvg` | avg(bonusRateLow, bonusRateHigh) |
| `bonusedMembersLow` | activationLow × bonusRateLow |
| `bonusedMembersHigh` | activationHigh × bonusRateHigh |
| `calc.bonusedMembersAvg` | avg of the two |
| `calc.spendPerTxnAvg` | avg(avgSpendPerTxnLow, avgSpendPerTxnHigh) |
| `bonusedSalesLow` | avgSpendPerTxnLow × bonusedMembersLow |
| `bonusedSalesHigh` | avgSpendPerTxnHigh × bonusedMembersHigh |
| `calc.bonusedSalesAvg` | avg of the two |
| `calc.basePointsLow` / `High` / `Avg` | bonusedSales × 10 (basePointsPerDollar) |
| `calc.bonusPointsLow` | 0 if status = Cancelled; else if Multiplier: basePointsLow × W; else bonusedMembersLow × W |
| `calc.bonusPointsHigh` | same with High |
| `calc.bonusPointsAvg` | avg of the two |
| `calc.basePointsRedeemableLow/High` | basePoints / 1000 × 2 |
| `calc.bonusPointsRedeemableLow/High/Avg` | bonusPoints / 1000 × 2 |
| `calc.redemptionRate` | 100% if offerDesign in ["Points donations", "Extra entries", "Limited Time Bonus Offer"]; else 88% if startDate ≥ 2025-10-01; else 85% |
| `bonusRedeemableLow` (DW) | bonusPointsRedeemableLow × redemptionRate |
| `bonusRedeemableHigh` (DX) | bonusPointsRedeemableHigh × redemptionRate |
| `calc.bonusRedeemableAvg` | avg of the two |
| `calc.jbpLow/High/Avg` | basePointsRedeemable + bonusPointsRedeemable (Low, High, avg) |

Show the step 7 right panel as a compact table: Low | High | Average for Activations, Bonused members, Bonused sales, Bonus points, Redeemable $ (100%), Redeemable $ with breakage; plus JBP total when Offset = JBP.

### 8.4 Results calculations

| Calc key | Formula |
|---|---|
| `calc.bonusRate` | bonusedMembers ÷ activations (show "Not available" if activations = 0) |
| `calc.activationRate` | activations ÷ audienceSize |
| `calc.bonusedSalesActual` | if Multiplier: bonusPtsIssued ÷ W ÷ 10; else "TBD" |
| `calc.basePointsActual` | 10 × bonusedSalesActual |
| `calc.basePointsRedeemableActual` | basePointsActual ÷ 1000 × 2 |
| `calc.bonusPointsRedeemableActual` | bonusPtsIssued ÷ 1000 × 2 |
| `calc.bonusRedeemableActualWithBreakage` | redemptionRate × bonusPointsRedeemableActual |
| `calc.spendPerBonusedMember` | bonusedSalesActual ÷ bonusedMembers |
| `calc.ltbpOutstanding` | if offerDesign = "Limited Time Bonus Offer": fixedPoints × activations |
| `calc.ltbpRemoved` | if status = Completed and LTBO: ltbpOutstanding − bonusPtsIssued |
| Helper for `bonusPtsIssued` | Button "Calculate from fixed points" = bonusedMembers × fixedPoints (Fixed Point offers only; user confirms) |

### 8.5 WBR strings and colour code (exact formatting)

| Column | Rule |
|---|---|
| Offer Period | `M/d-M/d` of start and end |
| Forecast activations (thousands) | if activationAvg missing: blank; else `floor(activationAvg/1000, 1 decimal) + "K"` |
| Forecast bonused member & rate | `N (R%)`: N = bonusedMembersAvg rounded if < 1000, else round(/1000) + "K"; R = bonusRateAvg as `0%` if ≥ 10%, `0.0%` if < 10%, "0%" if 0 |
| Forecast spend per bonused member | "N/A" if spendPerTxnAvg = 0; else `$` + round |
| Forecast bonus pts (MDs) | "N/A" if bonusPointsAvg = 0; else `1.2B` / `12M` / `120K` style + ` ($X)` using bonusRedeemableAvg (`$1.2M` / `$120K` style) |
| Actual activations | `1.23M` (2 decimals) if ≥ 1M; `123K` if ≥ 1000; else integer |
| Actual bonused member & rate | N as above + ` (R%)` where R = bonusRate×100 to 1 decimal if ≤ 9.5, else integer |
| Actual spend per bonused member | "TBD" or `$` + round |
| Actual bonus pts (MDs) | same style as forecast, $ from bonusRedeemableActualWithBreakage |
| Actual bonused sales | `$123`, `$123K` (< 500K), `$1.2M` |
| Days elapsed | blank if today < start; else min(today − start, numberOfDays) |
| % completed by days | daysElapsed ÷ numberOfDays |
| Prorated pts issued | bonusPtsIssued ÷ %completed (projects full-period points, as Excel does) |
| Colour code | blank if no prorated or no forecast; **Pink** if prorated < bonusPointsLow; **Dark Green** if prorated > bonusPointsHigh; else **Light Green** |

---

## 9. Validation rules (`lib/validation.ts`)

Errors block submission or the relevant status change. Warnings never block. All messages appear inline under the field and in the Validation panel.

| Field(s) | Rule | Type | Message |
|---|---|---|---|
| All `required` fields | Must have a value (N/A not accepted for required fields) | Error on submit | "{Label} is required." |
| offerId | Positive whole number; unique across all offers | Error | "Offer ID {x} is already used by {offer name}." |
| endDate | ≥ startDate | Error | "End Date must be on or after Start Date." |
| earlyActivationDate | If a date: < startDate | Error | "Early Activation must be before the Start Date." |
| ltbpRemovalDate | If both dates: ≥ ltbpExpiryDisplayed | Error | "Removal date must be on or after the displayed expiry date." |
| offerName | Matches `^\d{8}_[A-Z0-9$&_.\-]+$` | Warning | "Standard format is YYYYMMDD_DESCRIPTION_REWARD, e.g. 20251103_CANJBPDOGMERRICK_3X." |
| offerName | First 8 digits equal Start Date (yyyyMMdd) | Warning | "Name date {x} differs from Start Date {y}." |
| offerName | Unique across offers (case-insensitive) | Warning | "Another offer already uses this name. Allowed only in agreed cases (e.g. an activation offer and its promotion)." |
| subCategory | Pair exists in `categorySubCategory` | Error | "{Sub} is not a valid sub-category for {Category}." |
| offerTiering | If country = "CAN": tier ends with "CAN" (or Exclude/N/A) | Warning (proposed rule) | "Canada-only offers use CAN tiers (e.g. ACAN)." |
| multiplier / fixedPoints | Multiplier offers need a multiplier; Fixed Point offers need fixed points | Error (proposed rule) | "Enter the {multiplier / fixed points} for a {design} offer." |
| memberDescriptor | Required before Audited / Ready to go when Broad vs Targeted = Targeted | Error at transition | "Targeted offers need a Member Descriptor before audit." |
| canActivationDescriptor | Required when country includes CAN (value or "Using same code as USPR") | Warning | "Enter the CAN Activation Descriptor or 'Using same code as USPR'." |
| activationDescriptor, transactionExternalRefId, memberDescriptor | Unique across offers (ignoring N/A and "Using same code as USPR") | Warning | "Also used on {offer name}." |
| deactivationCode | If not N/A, matches `^\d{4}[DGEPX]\d+K\d*$` (MMYY + letter + amount) | Warning | "Expected format MMYYD#K# (see tooltip)." |
| offerCardLinkUS/CAN | Valid URL or N/A | Error | "Enter a full link starting with https:// or N/A." |
| bonusRateLow/High | 0 to 1 | Error | "Enter a rate between 0% and 100%." |
| activationByDayLow ≤ High, bonusRateLow ≤ High, avgSpend Low ≤ High | Low ≤ High | Warning | "Low is higher than High." |
| Numbers | Non-negative | Error | "Must be 0 or more." |
| Soft lock | If status is before Audited / Ready to go and today > softLockDate | Warning banner | "This offer is past its soft lock date ({date})." |
| Grouped children | Transaction External Ref IDs unique | Error | "Child IDs must be unique." |

---

## 10. Conditional display rules (`lib/visibility.ts`)

Hidden fields keep their stored value but are excluded from validation. "Country includes X" means the Country string contains X (e.g. "USPR, CAN" includes US, PR and CAN).

| Field id(s) | Show when |
|---|---|
| `canActivationDescriptor`, `canActivationDescriptorLength`, `disclaimerCAN`, `offerCardLinkCAN`, `canPrioritySkus` | Country includes CAN |
| `disclaimerUSPR`, `offerCardLinkUS`, `usprFosSignage`, `usprPrioritySkus` | Country includes US or PR |
| `locationCode` | Sub-Category = GRAND OPENING |
| `multiplier` | Offer Design = Multiplier or "Benefit - Choose 2X" (proposed rule) |
| `fixedPoints` | Offer Design ≠ Multiplier (proposed rule) |
| `ltbpExpiryDisplayed`, `ltbpRemovalDate` | Offer Design = Limited Time Bonus Offer |
| `optInMethod` | Activation Required = Yes (proposed rule) |
| `interactionType` | Offer Setup Type contains "Interaction" |
| `txnTypeFixedPointBack` | Offer Setup Type contains "Fixed Point Back" |
| `txnTypeUploadPts` | Offer Setup Type = "Manual Batch Upload : Earned" or Offer Design = "Activation Only - Points upload" |
| `memberDescriptor` | Broad vs Targeted = Targeted |
| `primaryBrand` | Brand Offer = Yes |
| `fundingStructure` | Offset = JBP (proposed rule) |
| `skuUploadDate` | SKU List = Yes |
| Grouped Offer tab | Grouped Offer = Yes |
| `subCategory` options | Filtered to the chosen Category |

When a field becomes hidden and it had a value, show a toast: "{Label} hidden because {reason}. Value kept."

---

## 11. UX behaviours

### 11.1 Saving
- **Drafts:** autosave 1 s after the last change; indicator in header. "Save draft" also saves immediately with a toast "Draft saved".
- **Existing offers:** edits are staged; "Save changes" commits and writes one audit entry per changed field. Autosave of a local backup every 5 s so nothing is lost on refresh; on return show "Restore unsaved changes?".
- **Submit offer:** runs full validation; on success status becomes Proposed, toast "Offer submitted as Proposed", audit entry, redirect to the offer.

### 11.2 CRUD
- **Create:** New offer opens step 1 with empty fields; defaults: `buildStatus` = Draft, all N/A-capable yes/no flags empty.
- **Read:** Offer list and workspace; read-only mode for View-only role (inputs disabled, banner "View only").
- **Update:** as above.
- **Copy:** duplicates all fields except Offer ID (blank), Offer Name (prefixed "COPY OF "), status (Draft), dates kept, checklist reset to empty, results cleared, forecast kept. Audit on both offers ("Copied from ...").
- **Delete:** drafts only, with confirmation. Submitted offers are cancelled, never deleted.
- **Cancel:** dialog with Reason (required) and Date (defaults today, writes `dateOfChangeCancel`).

### 11.3 Tooltips
- Info icon after every label; opens on hover and keyboard focus; max width 360 px.
- Content: tooltip text; then small grey lines: "Today: Excel column {excelColumn} '{excelHeader}'", "Source: {tooltipSource}". If source starts with DRAFT show an amber "Draft definition" tag.
- Select fields also show the option list count, and for Offer tiering show the tier definition of the selected value.
- Computed fields' tooltip shows the formula text from `computed`.

### 11.4 Inputs
- **Selects:** show "N/A" as a normal option when the list contains it. Keyboard searchable.
- **Comboboxes** (brands, transaction types, P&P Contact): type-ahead, show up to 50 matches; P&P Contact allows free text (today it is typed, e.g. "Victoria Burt / Mark Phillips").
- **dateOrNA:** date picker plus an "N/A" toggle.
- **currency:** `$` prefix, 2 decimals; **percent:** entered as %, stored as decimal (85% saves 0.85).
- **Numbers:** thousands separators on display.
- **Dates:** display `MM/DD/YYYY` (matches the submission form guide); store ISO `YYYY-MM-DD`.

### 11.5 Feedback
- Toasts for save, submit, status change, copy, cancel, export.
- Every destructive action has a confirm dialog.
- Loading states are instant (local data) but keep skeletons in the list for realism.

### 11.6 Accessibility
Labels bound to inputs, visible focus rings, tooltips reachable by keyboard, colour never the only signal (status pills include text).

---

## 12. End-to-end demo script (for the business walkthrough)

Use this as the in-app Help drawer content and as a test script.

1. **Offers list.** Show status chips and counts. Filter Country = CAN and Status = Completed - Data Final. Save the view as "CAN completed". Switch role to View-only: the saved view is per role; buttons are disabled.
2. **New offer** (role: Offer Team Editor). Step 1: Offer ID `9001`, Request Date today, Submitted By "Merch Team", P&P Contact "Victoria Burt", Start 11/02/2026, End 11/29/2026. Show Fiscal Week, Soft Lock Date and # of Days fill in. Try End before Start to show the error.
3. Step 2: Offer Name `20261102_DOGTREATS_25_2500`, Category MERCH (Sub-Category list filters to CONSUMABLES, HARDGOODS, SPECIALTY, ALL MERCH), Tier D (show tier definition), Country "USPR, CAN", Broad. Note that Canada fields appear in later steps.
4. Step 3: Product, Every time, Transactional, Threshold "24 (25)", Per Transaction, Fixed points 2500 (Multiplier hidden because design will be Fixed Point).
5. Step 5: Offer Design Fixed Point, click a "Common setup" to fill setup types. Enter Activation Descriptor and show the character count. Enter CAN descriptor "Using same code as USPR".
6. Leave the page, come back: autosave kept everything. Step 7: enter forecast (activation/day 300 to 400, bonus rate 60% to 70%, spend $30 to $35) and show the calculated totals and redeemable dollars.
7. Review: fix any required-field errors, **Submit offer** (Proposed). Show History.
8. Switch role to **Approver (TBC)**. Approvals queue shows the offer with its waiting time. **Approve offer and forecast** (Planning Phase). Point out the "SKUs to Promo Advisor within 7 days" reminder.
9. Switch back to Editor. Step 8 checklist: Submission Form Made = Yes, Submitted to Kognitiv = Yes, then **Mark submitted to loyalty platform** (Approved / Build Phase). Try **Mark audited and ready** before Offer Card and Audit are done: guard message. Complete them, move to Audited / Ready to go, then **Mark live**.
10. Open sample offer `20251229_BETTA_2500` (Completed - Data Final) and show step 9 results, calculated bonus rate and redeemable dollars. Open **WBR** and show forecast vs actual strings and colour codes.
11. Open `20260323_TIERA_50_5000`: Grouped Offer = Yes, show the Child promotions tab with 7 daily children and totals.
12. **Copy** an offer; **Cancel** another with a reason; show it stays visible as Cancelled and disappears from the WBR and the data feed count.
13. Switch to **Admin**. Reference data: add sub-category "PUPPY" under MERCH; go back to an offer and see it in the dropdown. Show the soft lock planner rows flagged as inconsistent.
14. **Data feed (Databricks):** pick an offer, show the 169 metadata columns with values, run **Simulate daily load**, then **Simulate failed load** and show that nothing was blanked.
15. **Data dictionary:** filter "Draft definitions" to show which tooltips the business must confirm.
16. **Phase 2 previews:** show the disabled Forecast pre-fill and LOPD buttons, the Inspire submission form preview populated from the offer, and the Calendar view.

---

## 13. Build plan (milestones for Claude Code)

1. **Scaffold:** Vite + React + TS + Tailwind; copy `/data` into `src/data`; typed loaders; Zustand store seeded from `sampleOffers.json`; Reset demo data.
2. **App shell:** sidebar, top bar, role switcher, routing, toasts, dialogs, PhaseBadge, ProposedRuleIcon.
3. **Field system:** `FieldRenderer` for every control type; `FieldTooltip`; N/A toggle; comboboxes; cascading category.
4. **Calculations, validation, visibility** libraries with unit tests (Vitest) using the worked checks in section 14.
5. **Offers list** with filters, saved views, columns, export, copy.
6. **Offer workspace:** steps 1 to 9, Review, right panel, autosave, submit.
7. **Lifecycle bar, transitions and guards;** History drawer.
8. **Grouped offer tab.**
9. **Approvals queue, WBR view.**
10. **Reference data admin, Evergreen offers, Data dictionary.**
11. **Data feed preview** with simulations.
12. **Phase 2 previews** (buttons, Inspire form preview, Calendar view).
13. **Polish:** empty states, keyboard, accessibility, demo script in Help drawer.

---

## 14. Acceptance checklist (verify before handing over)

**Data completeness**
- [ ] All 129 fields in `fields.json` appear either in a form step (123) or on the Data Dictionary page as system fields (6); none are missing.
- [ ] Every select/combobox uses exactly the values in `dropdowns.json` (spot-check Country = 7 values, Offer Design = 19, Status = 12, Sub-Category = 44, Brands = 2,758).
- [ ] Every field shows a tooltip; draft definitions are tagged.
- [ ] All 21 sample offers load; N/A values display as N/A.

**Calculations (worked checks)**
- [ ] Start 2025-11-01 gives Fiscal Week FW39 and Soft Lock 2025-09-04.
- [ ] Start 2025-11-01, End 2026-10-31 gives # of Days 365.
- [ ] Early Activation N/A, Start 2025-12-01, End 2026-01-31 gives Total offer days 62; Activation/day low 25 gives Activation Low 1,550 (matches sample row data).
- [ ] Multiplier "3X" gives bonus point factor 2; Fixed Point 2500 gives factor 2500.
- [ ] Offer Design "Points donations" gives redemption rate 100%; a Multiplier offer starting 2025-10-01 or later gives 88%; earlier gives 85%.
- [ ] 1,000,000 bonus points gives $2,000 redeemable at 100%.
- [ ] Cancelled offer: bonus points forecast 0, excluded from WBR and metadata feed.
- [ ] WBR strings match section 8.5 examples (e.g. 7,763 activations shows "8K").

**Flow**
- [ ] Draft autosaves and survives refresh.
- [ ] Cannot submit with missing required fields; errors link to fields.
- [ ] Each lifecycle guard in 7.3 blocks with a clear message when unmet and allows when met.
- [ ] Approve is only available to Approver and Admin.
- [ ] Every create, edit, status change, copy and cancel appears in History with old and new values.
- [ ] Copy resets ID, status, checklist and results.
- [ ] Cancel requires a reason and keeps the record.
- [ ] Reference list edits appear immediately in dropdowns and are logged.
- [ ] Simulated failed load does not change the displayed metadata values.
- [ ] Phase 2 items are visible, badged and non-functional.

---

## 15. Data findings to show the business (use as talking points and Data Dictionary notes)

These came from analysing the current files. Show them on the Data Dictionary page under "What we found in today's spreadsheet".

1. **Dropdown validation has drifted from its columns.** Columns were inserted over time, so some Excel dropdown rules now sit on the wrong column (e.g. the multiplier list is attached to the threshold columns; the award rule list is attached to Award Rule Max QTY). The prototype maps every dropdown to its correct field by meaning.
2. **Status list vs definitions.** The Status dropdown has 12 values; 2 of them (Forecast Only, Pending SteerCo Approval) have no written definition.
3. **Checklist completion is low.** Offer Audited is filled on about 599 of 1,108 offers; Secondary Audit on none.
4. **Case mismatch in the forecast-needed formula.** It checks "Merch", "Services"; the dropdown values are "MERCH", "SERVICES".
5. **Soft lock planner table has date errors** (e.g. Jan row ends before it starts; some soft lock dates fall after their month).
6. **Cross-tab links depend on names and running numbers,** so renames and cancellations can link the wrong data or show zero.
7. **Offer names:** 43 of 1,112 break the naming standard; 7 have a date that differs from the Start Date. The submission form guide shows `YYYY_MM_DD_PROMONAME` while real names use `YYYYMMDD`.
8. **Offer Submitted to Kognitiv** is labelled "Formula" in the spreadsheet but holds typed values.
9. **LOPD Actuals** column is never filled and marked "Remove in 2026".
10. **Loyalty platform naming:** status definitions say Capillary; checklist and fields say Kognitiv.

## 16. Open questions to display in the prototype (info icons)

| Where | Question |
|---|---|
| Approver role | Who approves offers? (steering committee?) |
| Forecast Only / Pending SteerCo Approval statuses | What do these statuses mean, and where do they sit in the flow? |
| Offer ID | How should Offer IDs be assigned in the product? |
| Offer Name uniqueness | When may two offers share a name? |
| Proposed rules (section 10) | Confirm each show/hide and cross-field rule |
| Retired reference values | Do past offers keep a retired category? |
| Grouped offers | Why daily children, and when must they be entered? |
| Kognitiv vs Capillary | Which platform does the build go to? |
| Draft definitions | Confirm every tooltip tagged Draft |


---

## Appendix A. Field catalogue (all 129 fields, grouped by step)

Tooltip text is shown in full. "Req" = required to submit. Options are keys into `dropdowns.json` (count in brackets). This table is generated from `fields.json`; if they ever differ, `fields.json` wins.


### 1. Request & Timing (13 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Unique Offer ID** (`offerId`) | B | number |  | Yes | Note: Entered by the team today (not auto-generated). Must be unique; prototype blocks duplicates. | Unique ID for each offer. (not autogenerated) _(Metadata column details)_ |
| 2 | **Offer Request Date** (`offerRequestDate`) | E | date |  | Yes |  | Date of offer submission from stakeholders in Offer submission form _(Calendar data dictionary (Offer Submission Date))_ |
| 3 | **Submitted By** (`submittedBy`) | BA | text |  | Yes | Note: Name of the stakeholder requesting the offer. | Denotes the name of the stakeholder who has requested the offer to Loyalty team _(Calendar data dictionary)_ |
| 4 | **P&P Contact** (`ppContact`) | AZ | combobox | `ppContacts` (5) | Yes | Note: Dropdown list exists (PP_contact_list) but column is typed today; combobox allows list or free text. | Denotes the name of the Loyalty team member from the Promotion team who is responsible for the setup of the loyalty offer _(Calendar data dictionary)_ |
| 5 | **Start Date** (`startDate`) | H | date |  | Yes |  | Start date of the promotion _(Calendar data dictionary)_ |
| 6 | **End Date** (`endDate`) | I | date |  | Yes | Validate: End Date must be on or after Start Date | End date of the promotion _(Calendar data dictionary)_ |
| 7 | **Early Activation Date (if activation starts before Offer Start Date)** (`earlyActivationDate`) | G | dateOrNA |  |  | Validate: Must be before Start Date when provided; N/A allowed | Date for Early Activation _(Calendar data dictionary)_ |
| 8 | **Start Month (calendar)** (`startMonth`) | C | computed |  |  | Calc: Month and year of Start Date (Excel: =H) | Calendar month when the promotion began _(Calendar data dictionary)_ |
| 9 | **Fiscal Week** (`fiscalWeek`) | D | computed |  |  | Calc: Lookup Start Date in fiscalCalendar -> fw (Excel: XLOOKUP on 'Fiscal Calendar') | Fiscal week of the promo start _(Calendar data dictionary)_ |
| 10 | **Soft Lock Date** (`softLockDate`) | F | computed |  |  | Calc: Lookup Start Date in softLockByStartDate (Excel: VLOOKUP on 'Soft Lock Dates'!A:B) | Date by which the offer should be final for its planning month; looked up from the Soft Lock Dates table using the Start Date. _(DRAFT (not in data dictionary; confirm with business))_ |
| 11 | **# of Days** (`numberOfDays`) | J | computed |  |  | Calc: End Date - Start Date + 1 | Number of days the promotion ran in the loyalty platform - need to sum these or use max / min date range for grouped promotions _(Calendar data dictionary)_ |
| 12 | **Due Dates? (planning month key)** (`dueDates`) | DA | computed |  |  | Calc: Month abbreviation + year of Start Date, e.g. Nov2025 | Calculated: Month abbreviation + year of Start Date, e.g. Nov2025 _(Excel formula)_ |
| 13 | **Dashboard Mo. (reporting)** (`dashboardMonth`) | CP | text |  |  | Note: Free text today, e.g. 'Dec, Jan 26'. | Month(s) the offer is reported in dashboards. _(DRAFT (not in data dictionary; confirm with business))_ |

### 2. Offer Basics (12 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Offer Name** (`offerName`) | O | text |  | Yes | Validate: Guide: YYYYMMDD_DESCRIPTION_REWARD (e.g. 20251103_CANJBPDOGMERRICK_3X). Warn if format differs or name already exists. | Standardized nomenclature for offer name should include date, type of offer, key offer format details (e.g., 3X,Spend Get). Column should be unique but in new UX there are times when it is not (e.g., an activation offer is set up with the same name as the corresponding promotion) - that said, for this purpose, the column is unique & we will navigate the other challenge as we work towards automation _(Calendar data dictionary)_ |
| 2 | **Loyalty Planning Category** (`category`) | K | select | `planningCategory` (15) | Yes |  | Categorize the loyalty into bigger buckets like Associate, Benefit, CRM, Digital, IMPO, etc. For all the cateogries, refer to "All Keys" tab in this file. _(Calendar data dictionary)_ |
| 3 | **Loyalty Planning Sub-Category** (`subCategory`) | L | select | `planningSubCategory` (44) | Yes | Depends on: category; Note: Filter options using reference.categorySubCategory for the chosen category. | Sub-Categorize the loyalty into one level down from Category like Afterpay, Anniversary, etc. For all the cateogries, refer to "All Keys" tab in this file. _(Calendar data dictionary)_ |
| 4 | **Category - Sub-Category** (`categoryConcat`) | DB | computed |  |  | Calc: Category + ' - ' + Sub-Category | Calculated: Category + ' - ' + Sub-Category _(Excel formula)_ |
| 5 | **Loyalty offer tiering** (`offerTiering`) | M | select | `offerTiering` (15) | Yes | Note: Show tier definitions (reference.tieringDefinitions) in tooltip/side panel. CAN-only offers use the CAN-suffixed tiers. | Denotes the tier of a loyalty offer based on the richness of the offer i.e. Bonus pts issued, channel it offered too, etc. Refer to "All Keys" tab in the Tiering tab _(Calendar data dictionary)_ |
| 6 | **Country / Markets** (`country`) | P | select | `country` (7) | Yes |  | Geography of the promotion - can be any country individually or any mix within although PR is almost always grouped with US total promotions _(Calendar data dictionary)_ |
| 7 | **Broad vs Targeted** (`broadVsTargeted`) | Q | select | `broadVsTargeted` (3) | Yes |  | Denotes if offer is open to all members within a geography ("broad") or to a targeted list of members _(Calendar data dictionary)_ |
| 8 | **Channel** (`channel`) | T | select | `channel` (7) |  |  | Denotes if offer is In-store only, Online only (incl BOPIS) or both _(Calendar data dictionary)_ |
| 9 | **Offer Short Description (member facing)** (`offerShortDescription`) | R | textarea |  |  |  | A pet parent facing offer description displayed in digitial platforms _(Metadata column details)_ |
| 10 | **Promotion Description (not member facing)** (`promotionDescription`) | S | textarea |  |  |  | Loyalty team use column explaining the offer - how to will bonus, experience and other details _(Metadata column details)_ |
| 11 | **Grouped Offer (Yes/No)** (`groupedOffer`) | AB | yesno | `yesNo` (2) |  | Note: If Yes, enable the Grouped Offer (child promotions) tab. | Denotes whether the offer is a grouped offer or not _(Calendar data dictionary)_ |
| 12 | **Build Status** (`buildStatus`) | N | select | `status` (12) |  | Read-only in form; Note: Changed only through the lifecycle bar actions, not typed in the form. | Denotes the stage of offer lifecycle _(Calendar data dictionary (Offer Build Status))_ |

### 3. Reward & Rules (13 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Product vs Basket** (`productVsBasket`) | U | select | `productVsBasket` (3) |  |  | Denotes if offer applies to the entire basket or a targeted sku list _(Calendar data dictionary)_ |
| 2 | **Award Rule** (`awardRule`) | V | select | `awardRule` (5) |  |  | Offers can either bonus members one time or multiple times within the promotion window _(Calendar data dictionary)_ |
| 3 | **Award Rule Max QTY** (`awardRuleMaxQty`) | W | number |  |  | N/A allowed; Note: Row 6 says Drop Down but values are numbers or N/A; validation in Excel points at the wrong list (drift). | Denotes how many times the bonus pts will be issued for the member on a qualified purchase. If the award rule is set as "Everytime", then it is set as "N/A" which means unlimited as award will be issued everytime. _(Calendar data dictionary)_ |
| 4 | **Free vs Transactional Points** (`freeVsTransactional`) | AA | select | `freeVsTransactional` (3) |  |  | For accounting purposes do the points need to be deferred against ("transactional") or are they ("free") and do not need to be deferred against _(Calendar data dictionary)_ |
| 5 | **Offer Threshold ($) [e.g. 49 (50)]** (`offerThreshold`) | AC | text |  |  | N/A allowed; Note: Values like '49 (50)' are used, so keep as text. | Qualifying spend threshold to earn bonus points for the promotion _(Calendar data dictionary)_ |
| 6 | **Inspire Offer Threshold ($)** (`inspireOfferThreshold`) | AD | currency |  |  | N/A allowed | Qualifying spend threshold to earn bonus points for the promotion configured in the Loyalty Platform i.e. Inspire _(Metadata column details)_ |
| 7 | **Display Offer Threshold ($)** (`displayOfferThreshold`) | AE | currency |  |  | N/A allowed | Qualifying spend threshold to earn bonus points for the promotion displayed to pet parent on digital platform _(Metadata column details)_ |
| 8 | **Offer Threshold Rule** (`offerThresholdRule`) | AF | select | `thresholdRule` (5) |  |  | Denotes at what level the Threshold is applied. For e.g. Per transactions, Per day or Per Promo Window _(Calendar data dictionary)_ |
| 9 | **Offer reward (Multiplier - 2X / 3X, etc.)** (`multiplier`) | AG | select | `multiplier` (13) |  | Show if: Offer Design = Multiplier or 'Benefit - Choose 2X' (proposed rule) | Denotes the denomination of the multiplier offer like 2X, 3X, etc. _(Calendar data dictionary)_ |
| 10 | **Offer reward (fixed amounts - pts)** (`fixedPoints`) | AH | number |  |  | Show if: Offer Design is not Multiplier (proposed rule); N/A allowed | Denotes the denomination of the Fixed points offers like 1000, 2000, etc. _(Calendar data dictionary)_ |
| 11 | **LTBP expiry date displayed** (`ltbpExpiryDisplayed`) | X | dateOrNA |  |  | Show if: Offer Design = Limited Time Bonus Offer; N/A allowed | The expiry date which is pet parent facing on digitial platforms. _(Metadata column details)_ |
| 12 | **LTBP pts removal date** (`ltbpRemovalDate`) | Y | dateOrNA |  |  | Show if: Offer Design = Limited Time Bonus Offer; Validate: On or after LTBP expiry date displayed; N/A allowed | The expiration date when the LTBP expired points are removed.  _(Metadata column details)_ |
| 13 | **Points Award Date (if different than activation date)** (`pointsAwardDate`) | Z | dateOrNA |  |  | N/A allowed | The date when the points are awarded manually. If the offer setup is "Manual Batch Upload : Earned", points will be uploaded manually with a list of members provided by Analytics team. In some cases, the points cab be loaded manually, when there is an error in offer setup and members were missed due to IT issues. _(Calendar data dictionary)_ |

### 4. Audience & Merchandising (20 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Targeted Audience Origination (Kognitiv vs PetSmart)** (`audienceOrigination`) | AI | select | `audienceOrigination` (3) |  |  | Denotes where the audience list is getting generated. If selected PetSmart, then there will be a member descriptor file will be sent to Kognitiv _(Calendar data dictionary)_ |
| 2 | **Member Exclusions** (`memberExclusions`) | AJ | select | `memberExclusion` (3) |  |  | Denotes which member list are excluded from the offer. Most of the time, it is "Employee" member descriptor is excluded from the offer. _(Calendar data dictionary)_ |
| 3 | **Tiered Offer Details (member tiers eligible)** (`tieredOfferDetails`) | BF | select | `memberTier` (7) |  |  | If the promotion is specific to a tier of members, it will be flagged in this column _(Calendar data dictionary)_ |
| 4 | **Brand Offer** (`brandOffer`) | BU | yesno | `yesNo2` (2) |  |  | Was the offer specific to a brand Y/N _(Calendar data dictionary)_ |
| 5 | **Proprietary Brand (Yes/No)** (`proprietaryBrand`) | BB | select | `proprietaryBrand` (3) |  |  | Was the offer specific to proprietary brands (also includes if the promotion includes many brands but is presented to the customer based on their personalized purchase history & includes proprietary brands as a featured brand) _(Metadata column details)_ |
| 6 | **Primary Brand Name** (`primaryBrand`) | BE | combobox | `brands` (2758) |  | Show if: Brand Offer = Yes; Note: 2,758 brands: use a searchable combobox. | Denotes the name of the brand if the offer is a brand level. If the offer based on multi-brand, then select multi-brand _(Calendar data dictionary)_ |
| 7 | **Offset** (`offset`) | BC | select | `offset` (8) |  |  | Describes if the offer was funded by JBP partners or drove offsets in another way (e.g., redemption offers where customers redeem points for additional entries in our sweepstakes) _(Calendar data dictionary)_ |
| 8 | **Funding Structure** (`fundingStructure`) | BD | select | `fundingStructure` (4) |  | Show if: Offset = JBP (proposed rule) | Used to provide a summary of the agreement by vendor of what part and portion of the points will be offset _(Metadata column details)_ |
| 9 | **Dog Customer** (`dogCustomer`) | BV | yesno | `yesNo2` (2) |  | Group: Pet type | Was the offer offered to Dog customer Y/N _(Calendar data dictionary)_ |
| 10 | **Cat Customer** (`catCustomer`) | BW | yesno | `yesNo2` (2) |  | Group: Pet type | Was the offer offered to Cat customer Y/N _(Calendar data dictionary)_ |
| 11 | **Bird Customer** (`birdCustomer`) | BX | yesno | `yesNo2` (2) |  | Group: Pet type | Was the offer offered to Bird customer Y/N _(Calendar data dictionary)_ |
| 12 | **Small Pet Customer** (`smallPetCustomer`) | BY | yesno | `yesNo2` (2) |  | Group: Pet type | Was the offer offered to Small Pet customer Y/N _(Calendar data dictionary)_ |
| 13 | **Reptile Customer** (`reptileCustomer`) | BZ | yesno | `yesNo2` (2) |  | Group: Pet type | Was the offer offered to Reptile customer Y/N _(Calendar data dictionary)_ |
| 14 | **Aquatic Customer** (`aquaticCustomer`) | CA | yesno | `yesNo2` (2) |  | Group: Pet type | Was the offer offered to Aquatic customer Y/N _(Calendar data dictionary)_ |
| 15 | **Hardgoods Offer** (`hardgoodsOffer`) | CB | yesno | `yesNo2` (2) |  | Group: Merchandise type | Was the offer on hard goods merchandise Y/N _(Calendar data dictionary)_ |
| 16 | **Consumables Offer** (`consumablesOffer`) | CC | yesno | `yesNo2` (2) |  | Group: Merchandise type | Was the offer on consumables merchandise Y/N _(Calendar data dictionary)_ |
| 17 | **Specialty Offer** (`specialtyOffer`) | CD | yesno | `yesNo2` (2) |  | Group: Merchandise type | Was the offer on specialty merchandise Y/N _(Calendar data dictionary)_ |
| 18 | **Services Offer** (`servicesOffer`) | CE | yesno | `yesNo2` (2) |  | Group: Merchandise type | Was the offer for Services Y/N _(Calendar data dictionary)_ |
| 19 | **Charities Offer** (`charitiesOffer`) | CF | yesno | `yesNo2` (2) |  | Group: Merchandise type | Was the offer for Charities Y/N _(Calendar data dictionary)_ |
| 20 | **Location Code (Grand Opening offers only)** (`locationCode`) | AW | text |  |  | Show if: Sub-Category = GRAND OPENING | Denotes the store number for which Grand Opening offer was created _(Calendar data dictionary)_ |

### 5. Loyalty Platform Setup (19 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Offer Design** (`offerDesign`) | AK | select | `offerDesign` (19) | Yes | Note: Show 'Common setups for this design' helper from reference.offerSetupCombos. | Setup: This column is defined to identify the category of the offer type from setup perspective like Multiplier, Fixed Point, etc. _(Calendar data dictionary)_ |
| 2 | **Kognitiv Activation Setup Type** (`kognitivActivationSetupType`) | AL | select | `activationSetup` (9) |  |  | Setup: This column is define how the offer's activation is setup in Kognitiv _(Calendar data dictionary)_ |
| 3 | **Kognitiv Offer Setup Type** (`kognitivOfferSetupType`) | AM | select | `offerSetupType` (14) |  |  | Setup: This column defines how the setup of bonus issuance is configured in the Kognitiv _(Calendar data dictionary)_ |
| 4 | **Activation Required** (`activationRequired`) | AN | yesno | `yesNo2` (2) |  |  | Setup: Most loyalty offers require activation (capability launched in mid-2019 & became standard practice in 2021) _(Calendar data dictionary)_ |
| 5 | **Opt-In Method** (`optInMethod`) | AO | select | `optInMethod` (6) |  | Show if: Activation Required = Yes (proposed rule) | Setup: Choice Reward was the mechanism used until March 2024 & now "Promotional Activation" is the most common mechanism but we utilize both promotion types. _(Calendar data dictionary)_ |
| 6 | **Auto-activation configured (Yes/No)** (`autoActivationConfigured`) | AQ | yesno | `yesNo2` (2) |  |  | Denotes if the offer is already auto-activated. These offers are very rare. Contact Loyalty team for details. _(Calendar data dictionary)_ |
| 7 | **Post-Activation Descriptor** (`postActivationDescriptor`) | AR | text |  |  | N/A allowed | Descriptor applied after activation (e.g. tier override). _(DRAFT (not in data dictionary; confirm with business))_ |
| 8 | **Deactivation Code** (`deactivationCode`) | AP | text |  |  | Validate: Format MMYYD#K# (see reference.deactivationRules); warn if not matching; N/A allowed | Deactivation reference code. Nomenclature MMYYD#K# (MM = month, YY = year, D = donation / G = gift card giveaway / E = extra entries / P = partner / X = other, #K# = offer amount, e.g. 1000 = 1K). _(DRAFT (not in data dictionary; confirm with business))_ |
| 9 | **Interaction Type** (`interactionType`) | AS | select | `interactionType` (27) |  | Show if: Offer Setup Type contains 'Interaction' | Denotes the types of the interaction used for the Loyalty offer _(Calendar data dictionary)_ |
| 10 | **Transaction Type (Fixed Point Back)** (`txnTypeFixedPointBack`) | AT | combobox | `transactionTypes` (454) |  | Show if: Offer Setup Type contains 'Fixed Point Back' | The name of the transaction type on which Batch Promotion : Fixed Points back points were uploaded like Afterpay, Bopis, etc.  _(Metadata column details)_ |
| 11 | **Transaction Type Upload Pts (Manual Batch Upload)** (`txnTypeUploadPts`) | AU | combobox | `transactionTypes` (454) |  | Show if: Offer Setup Type = 'Manual Batch Upload : Earned' or Offer Design = 'Activation Only - Points upload' | Denotes on which Transaction Type the points were uploaded _(Calendar data dictionary)_ |
| 12 | **Transaction Type Remove Pts (Manual Removal)** (`txnTypeRemovePts`) | AV | combobox | `transactionTypes` (454) |  |  | Denotes on which Transaction Type the points were removed _(Calendar data dictionary)_ |
| 13 | **Member Descriptor** (`memberDescriptor`) | BG | text |  |  | Show if: Broad vs Targeted = Targeted; Validate: Unique; missing on a Targeted offer is what 'Pending MD' status means; N/A allowed | Unique identifier to identify the target member list of an offer _(Calendar data dictionary)_ |
| 14 | **Internal Reward External Ref** (`internalRewardExternalRef`) | BH | text |  |  | N/A allowed | Unique Internal Reward ID used to identify members for additional automation _(Metadata column details)_ |
| 15 | **Transaction External Ref ID** (`transactionExternalRefId`) | BI | text |  |  | Validate: Unique across offers; N/A allowed | Unique Bonus ID used in the promotion type selected in the column "Kognitiv Offer Setup Type" _(Calendar data dictionary)_ |
| 16 | **Activation Descriptor (External Reference ID)** (`activationDescriptor`) | BJ | text |  |  | Validate: Unique across offers; show character count; N/A allowed | Unique promotion identifier used for displaying the right creative to the members eligible for the promotion. However, opt in promotions use the same identifier for both purposes (offer & display) _(Calendar data dictionary)_ |
| 17 | **Loyalty Use - Count (US)** (`activationDescriptorLength`) | BK | computed |  |  | Calc: Character length of Activation Descriptor (Excel: =LEN(BJ)) | Character count of the US Activation Descriptor. _(DRAFT (not in data dictionary; confirm with business))_ |
| 18 | **CAN Activation Descriptor** (`canActivationDescriptor`) | BL | text |  |  | Show if: Country includes CAN; N/A allowed; Note: Common value today: 'Using same code as USPR'. | Unique promotion identifier but specific to Canada; some promotions will have the same identifier for all geographies, some have a different one for US and CAN _(Calendar data dictionary)_ |
| 19 | **Loyalty Use - Count (CAN)** (`canActivationDescriptorLength`) | BM | computed |  |  | Show if: Country includes CAN; Calc: Character length of CAN Activation Descriptor (Excel: =LEN(BL)) | Character count of the CAN Activation Descriptor. _(DRAFT (not in data dictionary; confirm with business))_ |

### 6. Content, Signage & SKUs (13 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Disclaimer USPR** (`disclaimerUSPR`) | AX | textarea |  |  | Show if: Country includes US or PR | Denotes the disclaimer used for the USPR based offers _(Calendar data dictionary)_ |
| 2 | **Disclaimer CAN** (`disclaimerCAN`) | AY | textarea |  |  | Show if: Country includes CAN | Denotes the disclaimer used for the CAN based offer _(Calendar data dictionary)_ |
| 3 | **Web Link for Offer Card (US)** (`offerCardLinkUS`) | CN | url |  |  | Show if: Country includes US or PR; N/A allowed | Share the web link of the offer card for USPR offer _(Calendar data dictionary)_ |
| 4 | **Web Link for Offer Card (CAN)** (`offerCardLinkCAN`) | CO | url |  |  | Show if: Country includes CAN; N/A allowed | Share the web link of the offer card for CAN offer _(Calendar data dictionary)_ |
| 5 | **Signage Requested (Yes/No)** (`signageRequested`) | CH | yesno | `yesNoNA` (3) |  |  | Identify offers where Signage is requested _(Metadata column details)_ |
| 6 | **Labels Requested (Yes/No)** (`labelsRequested`) | CI | yesno | `yesNoNA` (3) |  |  | Identify offers where Labels are requested _(Metadata column details)_ |
| 7 | **USPR FOS Signage** (`usprFosSignage`) | CJ | yesno | `yesNoNA` (3) |  | Show if: Country includes US or PR | Identify offer where Badging is requested _(Metadata column details)_ |
| 8 | **Red Text (Yes/No)** (`redText`) | CK | yesno | `yesNoNA` (3) |  |  | Identify offers that require Red Text to support Digital. Includes both product and basket offers. _(Metadata column details)_ |
| 9 | **Analytical Req JIRA Ticket #** (`jiraTicket`) | CG | text |  |  | N/A allowed | Denotes the JIRA ticket # if there is an analytical request was created _(Calendar data dictionary)_ |
| 10 | **SKU List (Yes/No)** (`skuList`) | BO | select | `yesNoNA` (3) |  |  | Ops : Denotes if the SKU list was submitted to Kognitiv or not _(Calendar data dictionary)_ |
| 11 | **SKU list upload date to DB** (`skuUploadDate`) | BP | dateOrNA |  |  | Show if: SKU List = Yes; N/A allowed | Date the SKU list was uploaded to Databricks. _(DRAFT (not in data dictionary; confirm with business))_ |
| 12 | **USPR Priority SKUs** (`usprPrioritySkus`) | CQ | textarea |  |  | Show if: Country includes US or PR | Shows a list of USPR priority SKUs for Hero offers _(Metadata column details)_ |
| 13 | **CAN Priority SKUs** (`canPrioritySkus`) | CR | textarea |  |  | Show if: Country includes CAN | Shows a list of CAN priority SKUs for Hero offers _(Metadata column details)_ |

### 7. Forecast (19 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Fcst Date** (`forecastDate`) | DH | dateOrNA |  |  | N/A allowed | Date the forecast was created. _(DRAFT (not in data dictionary; confirm with business))_ |
| 2 | **Forecast Created by** (`forecastCreatedBy`) | DI | text |  |  |  | Initials of the person who created the forecast. _(DRAFT (not in data dictionary; confirm with business))_ |
| 3 | **Forecast needed?** (`forecastNeeded`) | DY | computed |  |  | Calc: See calculations.forecastNeeded | Whether this offer needs a forecast, based on category, offer design and status. _(DRAFT (not in data dictionary; confirm with business))_ |
| 4 | **Forecast Status / Notes** (`forecastStatus`) | DZ | select | `forecastStatus` (7) |  | Note: Header says 'Forecast Notes' but the dropdown attached is the Forecast Status list. | Forecast status (Forecast Needed, Audience Estimation, Analytics, Overdue Forecast, Pending PAM Confirmation, Completed). _(DRAFT (not in data dictionary; confirm with business))_ |
| 5 | **Total offer days including pre-activation** (`totalOfferDays`) | DJ | computed |  |  | Calc: If Early Activation = N/A: End - Start + 1, else End - Early Activation + 1 | Offer days including any early activation days. _(DRAFT (not in data dictionary; confirm with business))_ |
| 6 | **Activation by day - Low** (`activationByDayLow`) | DK | number |  |  |  | Low estimate of activations per day. _(DRAFT (not in data dictionary; confirm with business))_ |
| 7 | **Activation by day - High** (`activationByDayHigh`) | DL | number |  |  |  | High estimate of activations per day. _(DRAFT (not in data dictionary; confirm with business))_ |
| 8 | **Activation - Low** (`activationLow`) | DM | computed |  |  | Calc: Activation by day - Low x Total offer days | Calculated: Activation by day - Low x Total offer days _(Excel formula)_ |
| 9 | **Activation - High** (`activationHigh`) | DN | computed |  |  | Calc: Activation by day - High x Total offer days | Calculated: Activation by day - High x Total offer days _(Excel formula)_ |
| 10 | **Bonus rate - Low** (`bonusRateLow`) | DO | percent |  |  | Note: Stored as decimal, e.g. 0.85 | Shows the forecast bonus rate on the low range _(Metadata column details)_ |
| 11 | **Bonus rate - High** (`bonusRateHigh`) | DP | percent |  |  |  | Shows the forecast bonus rate on the high range _(Metadata column details)_ |
| 12 | **Avg Spend/txn - Low** (`avgSpendPerTxnLow`) | DQ | currency |  |  |  | Low estimate of average spend per transaction for bonused members. _(DRAFT (not in data dictionary; confirm with business))_ |
| 13 | **Avg spend/txn - High** (`avgSpendPerTxnHigh`) | DR | currency |  |  |  | High estimate of average spend per transaction for bonused members. _(DRAFT (not in data dictionary; confirm with business))_ |
| 14 | **Bonused members - Low** (`bonusedMembersLow`) | DS | computed |  |  | Calc: Activation - Low x Bonus rate - Low | Count of members who bonused on the transaction. In this case members who purchased on multiple days may be counted more than once in this total (we have a separate metric that we are working to update for unique members bonused) _(Metadata column details)_ |
| 15 | **Bonused members - High** (`bonusedMembersHigh`) | DT | computed |  |  | Calc: Activation - High x Bonus rate - High | Count of members who bonused on the transaction. In this case members who purchased on multiple days may be counted more than once in this total (we have a separate metric that we are working to update for unique members bonused) _(Metadata column details)_ |
| 16 | **Bonused sales - Low** (`bonusedSalesLow`) | DU | computed |  |  | Calc: Avg Spend/txn - Low x Bonused members - Low | Bonus Pts Issued / Bonus point calculation / Base Pts per dollar _(Metadata column details)_ |
| 17 | **Bonused Sales - High** (`bonusedSalesHigh`) | DV | computed |  |  | Calc: Avg spend/txn - High x Bonused members - High | Bonus Pts Issued / Bonus point calculation / Base Pts per dollar _(Metadata column details)_ |
| 18 | **Bonus points redeemable $ (w/ breakage) - Low** (`bonusRedeemableLow`) | DW | computed |  |  | Calc: See calculations.forecast (BG) | Bonus pts issued / 1000 * Redemption conversion _(Metadata column details)_ |
| 19 | **Bonus points redeemable $ (w/ breakage) - High** (`bonusRedeemableHigh`) | DX | computed |  |  | Calc: See calculations.forecast (BH) | Bonus pts issued / 1000 * Redemption conversion _(Metadata column details)_ |

### 8. Build Checklist (8 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Submission Form Made (Yes/No)** (`submissionFormMade`) | BN | select | `yesNoNA` (3) |  |  | Ops : Denotes whether Offer Submission form was made or not _(Calendar data dictionary)_ |
| 2 | **Offer Submitted to Kognitiv (Yes/No)** (`submittedToKognitiv`) | BQ | select | `yesNoNA` (3) |  | Note: Row 6 labels it Formula but cells hold typed Yes/No. | Ops : Denotes whether offer submission form was sent to Kognitiv _(Calendar data dictionary)_ |
| 3 | **Offer Card Built in Contentful (Yes/No)** (`offerCardBuilt`) | BR | select | `yesNoNA` (3) |  |  | Ops : Denotes whether offer card was built in contentful or not _(Calendar data dictionary)_ |
| 4 | **Offer Audited (Yes/No/Partially)** (`offerAudited`) | BS | select | `audit` (4) |  |  | Ops : Denotes whether offer was audited or not _(Calendar data dictionary)_ |
| 5 | **Secondary Audit** (`secondaryAudit`) | BT | select | `audit` (4) |  | Note: Never filled today (0 offers). | Second audit of the offer build. _(DRAFT (not in data dictionary; confirm with business))_ |
| 6 | **Date of Change / Cancel** (`dateOfChangeCancel`) | CL | dateOrNA |  |  | N/A allowed; Note: Prototype also asks for a reason (UX addition) and writes the audit log. | Date the offer was changed or cancelled. _(DRAFT (not in data dictionary; confirm with business))_ |
| 7 | **Appeasement** (`appeasement`) | CM | text |  |  | Note: Column re-named 11/12/25. | Appeasement details for the offer (column renamed 11/12/25). _(DRAFT (not in data dictionary; confirm with business))_ |
| 8 | **Notes** (`notes`) | CT | textarea |  |  |  | Free-text notes about the offer. _(DRAFT (not in data dictionary; confirm with business))_ |

### 9. Results (6 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Results Date Updated** (`resultsDateUpdated`) | DC | text |  |  | Note: Free text today, e.g. '2/9/2026 VB' (date + initials). | When results were last updated, and by whom (e.g. '2/9/2026 VB'). _(DRAFT (not in data dictionary; confirm with business))_ |
| 2 | **Audience Size** (`audienceSize`) | DD | number |  |  |  | Eligible audience size (missing in some cases we need to go back and pull) _(Calendar data dictionary)_ |
| 3 | **Activations** (`activations`) | DE | number |  |  |  | Count of unique members who activated the offer (i.e., raised hand for the promotion) _(Calendar data dictionary)_ |
| 4 | **Bonused members** (`bonusedMembers`) | DF | number |  |  |  | Count of members who bonused on the transaction. In this case members who purchased on multiple days may be counted more than once in this total (we have a separate metric that we are working to update for unique members bonused) _(Calendar data dictionary)_ |
| 5 | **Bonus Pts Issued** (`bonusPtsIssued`) | DG | number |  |  | Note: Some rows compute Bonused members x fixed points (e.g. =DF*500); offer a 'Calculate from fixed points' helper. | Total promotional bonus points issued _(Calendar data dictionary)_ |
| 6 | **LOPD Actuals** (`lopdActuals`) | CS | text |  |  | Phase 2; Note: Never filled; note in Excel says 'Remove in 2026'. Show as disabled 'Auto-pull from LOPD (Phase 2)'. | Actual results from the LOPD data product (not used today). _(DRAFT (not in data dictionary; confirm with business))_ |

### System (hidden) (6 fields)

| # | Field (id) | Excel col | Control | Options | Req | Show if / rule | Tooltip (source) |
|---|---|---|---|---|---|---|---|
| 1 | **Include for Metadata?** (`includeForMetadata`) | CU | computed |  |  | Calc: 'No' if Status = Cancelled, else 'Yes' | Calculated: 'No' if Status = Cancelled, else 'Yes' _(Excel formula)_ |
| 2 | **Reference number for Metadata file** (`metadataRefNumber`) | CV | hidden |  |  | Calc: Running number MAX(above)+1 in Excel. NOT needed in product (use Offer ID). | Calculated: Running number MAX(above)+1 in Excel. NOT needed in product (use Offer ID). _(Excel formula)_ |
| 3 | **Include for Results and Forecast?** (`includeForResultsForecast`) | CW | computed |  |  | Calc: 'No' if Status = Cancelled or Offer Design = 'IMP only', else 'Yes' | Calculated: 'No' if Status = Cancelled or Offer Design = 'IMP only', else 'Yes' _(Excel formula)_ |
| 4 | **Reference Results and Forecast?** (`resultsForecastRefNumber`) | CX | hidden |  |  | Calc: Running number in Excel. NOT needed in product. | Running reference number used to link the Results and Forecast tab (Excel only). _(DRAFT (not in data dictionary; confirm with business))_ |
| 5 | **Date formatting (start month)** (`startMonthNumber`) | CY | hidden |  |  | Calc: MONTH(Start Date) | Calculated: MONTH(Start Date) _(Excel formula)_ |
| 6 | **Date formatting (start year)** (`startYear`) | CZ | hidden |  |  | Calc: YEAR(Start Date) | Calculated: YEAR(Start Date) _(Excel formula)_ |

---
## Appendix B. Dropdown lists

Small lists are shown in full. Large lists (brands 2,758; transactionTypes 454) are only in `dropdowns.json`.

| Key | Count | Values |
|---|---|---|
| `planningCategory` | 15 | ASSOCIATE; BENEFIT; CHARITIES; CRM; DIGITAL; EVENT; IMPO; BARCODE; LOYALTY; MERCH; PARTNER; POINTS BOOST; REDEMPTION; SERVICES; SWEEPS |
| `planningSubCategory` | 44 | 2X CHARITIES; AFTERPAY; ADOPTVIPP; ALL MERCH; ALL SERVICES; ANNIVERSARY; APP DOWNLOAD; ASSOCIATE; AUTOSHIP; BIRTHDAY; BIRTHDAYRSVP; BOPIS; CHOOSE 2X; CONSUMABLES; ENTRIES; EVENTRSVP; GIFT CARD; GOOD KARMA; GRAND OPENING; HARDGOODS; HOTEL; KEY PROMO; MARKETPLACE; MERCH-SERVICE; OTHER; PARTNER; POINTS DONATION; POINTS PAYOUT; PRIZES; PROFILE COMPLETION; REDEEM REPEAT; REPLENISHMENT; SALON; SALON CERT; SALON-HOTEL; SAME DAY DELIVERY; SERVICES; SPECIALTY; TEST; TIER BONUS; TIER EVENT; TRAINING; TRIP CHALLENGE; VIPP GIFT |
| `offerTiering` | 15 | A; ACAN; B; BCAN; C; CCAN; C+; C+CAN; D; DCAN; D+; D+CAN; R; Exclude; N/A |
| `status` | 12 | Forecast Only; Pending SteerCo Approval; Proposed; Planning Phase; Approved / Build Phase; Pending MD; Audited / Ready to go; Live; Completed; Completed - Data Final; Pending Points Upload; Cancelled |
| `country` | 7 | US; USPR; USPR, CAN; CAN; CAN, PR; US, CAN; N/A |
| `broadVsTargeted` | 3 | Broad; Targeted; N/A |
| `channel` | 7 | Both; In-Store; Online; Bopis; Both(US) Online(CAN); App; N/A |
| `productVsBasket` | 3 | Product; Basket; N/A |
| `awardRule` | 5 | Every time; Once per day; One time; Other; N/A |
| `freeVsTransactional` | 3 | Free; Transactional; N/A |
| `thresholdRule` | 5 | Per Transaction; Per Day; Per Promo Window; N/A; Per Spend |
| `multiplier` | 13 | 2X; 3X; 4X; 5X; 6X; 7X; 8X; 9X; 10X; 11X; 15X; 25X; N/A |
| `audienceOrigination` | 3 | Inspire; PetSmart; Promo Seg Group |
| `memberExclusion` | 3 | Employee; Member Tier; N/A |
| `memberTier` | 7 | All; Member only; Bestie only; VIPP only; Associate VIPP Only; VIPP + Bestie; N/A |
| `yesNo` | 2 | Yes; No |
| `yesNo2` | 2 | Yes; No |
| `yesNoNA` | 3 | Yes; No; N/A |
| `proprietaryBrand` | 3 | Yes; No; N/A |
| `brands` | 2758 | (see dropdowns.json) |
| `offset` | 8 | JBP; Digital; Donation Redemption; Loyalty; Merch; Offset Redemption; Partner; N/A |
| `fundingStructure` | 4 | Kit; Offer Only; Custom; N/A |
| `offerDesign` | 19 | Multiplier; Fixed Point; Multi-trip challenge; Multiple threshold; Activation Only - RSVP; Activation Only - Internal Reward; Activation Only - Points upload; Activation Only - Tier Upgrade; Activation Only - Other; Limited Time Bonus Offer; IMP only; Points donations; Extra entries; Salon cert; Benefit - Choose 2X; Internal Reward; Interactions; To Discuss; N/A |
| `activationSetup` | 9 | Choice Reward & Internet Message Promotion; Email Activation only; Transaction Bonus Promotion; Transaction Product Bonus Promotion; Transaction Product Quantity Bonus Promotion; Transaction Product Value Bonus Promotion; No Rule segment & TBP Activation Only; To Discuss; N/A |
| `offerSetupType` | 14 | Batch Promotion : Batch Reward Promotion; Batch Promotion : Fixed Point Back; Batch Promotion : Recurring Transaction Promotion; Interaction Bonus Promotion & FPB Promo; Interaction Bonus Promotion; Internet Message Promotion; Manual Batch Upload : Earned; Promo Segments & Internet Message Promotion; Transaction Bonus Promotion; Transaction Product Bonus Promotion; Transaction Product Quantity Bonus Promotion; Transaction Product Value Bonus Promotion; To Discuss; N/A |
| `optInMethod` | 6 | Choice Rewards; Promotional Activation; Mulitple (Choice to Promo Act); Mulitple (Promo Act to Choice); To Discuss; N/A |
| `interactionType` | 27 | Address Added; Autoship Enrollment; Birthdate Added; CSR Lookup; Door Dash Orders; Email Added; InApp Purchase; Mobile App Download; Phone Added; Profile Complete; Push Opt In; Short Term Anniversary; Short Term Associate Bonus Points; Short Term Birthday 1; Short Term Birthday 2; Short Term Guide; Short Term Holiday Bonus Points; Short Term Quartile A; Short Term Quartile B; Short Term Quartile C; Short Term Saving Bonus Points; ShortTerm Bonus Points; SMS Text Ipt In; Suspended Status Disabled; Suspended Status Enabled; Text Opt In; N/A |
| `transactionTypes` | 454 | (see dropdowns.json) |
| `ppContacts` | 5 | Victoria Burt; Frankie Romero; Amber Austin; Nicole Riley; Devashree C |
| `audit` | 4 | Yes; No; Partially; N/A |
| `forecastStatus` | 7 | Forecast Needed; Audience Estimation; Analytics; Overdue Forecast; Pending PAM Confirmation; Completed; N/A |
| `_unusedInMainTab_offerCardTier` | 10 | A+; A; A-; B; C; D; E-CAN; F-CAN; Exclude; N/A |
| `_unusedInMainTab_signageType` | 5 | Branded; Promo; Mailroom; Enterprise; N/A |
| `_unusedInMainTab_txnPublicName` | 40 | Account Merge Adjustment; ACTIVATION ONLY; Afterpay Bonus; Anniversary Bonus; App Download Bonus; Associate Offer Bonus; Autoship Bonus; Autoship Limited Time Bonus Points; Balance Adjustment; Bonus Points Activity; CAPS-291 Test Transaction; Customer Care; DoorDash Bonus; DoorDash Transaction Adjustment; Events Bonus; Instacart Transaction Adjustment; In-Store Purchase; Limited Time Bonus Expiration; Limited Time Bonus Points; Offline Transaction Adjustment; Online Purchase; Online Services Purchase; Other Activity; Other Activity; Pick Up In Store Bonus; Points Donation; Profile Completion Bonus; Push Opt-in Bonus; Quarterly Payout; Returned Points from Cancelled Order; Shipt Transaction Adjustment; SMS Opt-in Bonus; Treats Promotion Prize; Treats Rewards Launch Balance Conversion; Treats Rewards Promotion Prize; Trips for Treats Bonus; Trips for Treats Rewards Bonus; VB TEST 20240219; Volunteer Bonus; N/A |
| `_unusedInMainTab_cbPost` | 4 | Yes; No; Decider; N/A |
| `_unusedInMainTab_fundingSplit` | 4 | Base and Bonus; Bonus; Custom; N/A |

---
## Appendix C. Category and sub-category pairs

| Category | Sub-Category | New | Example |
|---|---|---|---|
| ASSOCIATE | ASSOCIATE |  |  |
| BENEFIT | SALON CERT |  | Salon payout card |
| BENEFIT | TIER BONUS |  | Tier Bonus - VIPP, Tier Bonus - bestie (extra benefit points) |
| BENEFIT | 2X CHARITIES |  | Donations_2X |
| BENEFIT | BIRTHDAY |  | 1000 pts and 2X |
| BENEFIT | BIRTHDAYRSVP |  |  |
| BENEFIT | ANNIVERSARY |  | 1000 pts |
| BENEFIT | CHOOSE 2X |  |  |
| BENEFIT | POINTS PAYOUT | Yes | Autoship Points Payout card |
| BENEFIT | TIER EVENT | Yes |  |
| BENEFIT | VIPP GIFT | Yes | only will be in December |
| CRM | REPLENISHMENT | Yes |  |
| CRM | TRIP CHALLENGE | Yes |  |
| CRM | APP DOWNLOAD | Yes |  |
| CRM | PROFILE COMPLETION | Yes |  |
| CRM | OTHER | Yes | e.g. National Trivia day |
| DIGITAL | BOPIS |  |  |
| DIGITAL | SAME DAY DELIVERY | Yes |  |
| DIGITAL | MARKETPLACE | Yes | Any marketplace |
| DIGITAL | AUTOSHIP |  |  |
| REDEMPTION | REDEEM REPEAT | Yes |  |
| REDEMPTION | POINTS DONATION | Yes |  |
| REDEMPTION | ENTRIES |  | Extra entries or single for for sweepstakes |
| REDEMPTION | OTHER | Yes |  |
| IMPO | PARTNER |  | Birthday Shutterfly |
| IMPO | GIFT CARD |  |  |
| IMPO | SERVICES |  | Salon benefit info card |
| IMPO | ENTRIES |  | App download extra enteries (activation only) |
| IMPO | CHOOSE 2X |  | Locked 2X |
| IMPO | AUTOSHIP | Yes | Autoship Payout Benefit Info Card |
| IMPO | POINTS PAYOUT | Yes | Autoship Payout Journey Cards |
| IMPO | OTHER |  |  |
| BARCODE | SALON CERT | Yes | Before 2026 Salon Cert program |
| BARCODE | SERVICES | Yes | Existing Services Barcode offers e.g. Yappy hour, etc |
| LOYALTY | KEY PROMO |  | All Tier A offers |
| LOYALTY | GRAND OPENING | Yes |  |
| LOYALTY | POINTS BOOST |  | All Non-Tier A offers and Loyalty orginated |
| LOYALTY | OTHER |  |  |
| MERCH | CONSUMABLES |  |  |
| MERCH | HARDGOODS |  |  |
| MERCH | SPECIALTY | Yes |  |
| MERCH | ALL MERCH | Yes |  |
| SWEEPS | PRIZES |  |  |
| PARTNER | AFTERPAY |  |  |
| SERVICES | ALL SERVICES |  |  |
| SERVICES | SALON |  |  |
| SERVICES | SALON-HOTEL |  |  |
| SERVICES | HOTEL |  |  |
| SERVICES | TRAINING |  |  |

---
## Appendix D. Offer tiering definitions

| Tier | Description | Example |
|---|---|---|
| A | Major omni offer, >$100K $MDs in issued points expected per day, broad in USPR or all geographies | Spend $100 Get 10,000 pts |
| B | High richness basket offer that is targeted or channel specific | 10X BOPIS, 5X VIPP Gift |
| C | Meaningful & Broad eligibility product category or brand specific offers. Only used for "every time earn" promotions with $40K estimated point liability or more | Spend $60 Get 5,000 Dog CONS; 10X Purina |
| C+ | Same as "C" but used for "one time earn" promotions | Spend $60 Get 5,000 Dog CONS; 10X Purina |
| D | Broad eligibility product category or brand specific offers. Only used for "every time earn" promotions with <$40K estimated point liability | 3X Wild Bird |
| D+ | Same as "D" but used for "one time earn" promotions | 3X Wild Bird |
| R | Meaningful scale redemption focused offers & limited time bonus point offers | VIPP & Bestie Redeem & Repeat, Claim Your Savings |
| Exclude | All offers not intended for modeling at this stage (includes billboard placements, donation offers, smaller branded or category offers, GPs, Afterpay offers, specific geography offers unless otherwise categorized etc). | Grand Opening 5X, Billboard placements, Spend $75 Get 6,000 pts when using Afterpay |

Note: CAN-only offers use the same tiering as USPRCAN offers but have CAN appended - e.g., ACAN, BCAN, CAN, C+CAN, RCAN. Threshold changed from $40K to $10K for the C vs. D designations


---
## Appendix E. Common offer setups (Offer Design to Kognitiv setup)

| Offer Design | Kognitiv Activation Setup Type | Kognitiv Offer Setup Type | Opt-In Method |
|---|---|---|---|
| Multiplier | Transaction Bonus Promotion | Transaction Bonus Promotion | Promotional Activation |
| Multiplier | Transaction Product Bonus Promotion | Transaction Product Bonus Promotion | Promotional Activation |
| Multiplier | Transaction Product Quantity Bonus Promotion | Transaction Product Quantity Bonus Promotion | Promotional Activation |
| Multiplier | Transaction Product Value Bonus Promotion | Transaction Product Value Bonus Promotion | Promotional Activation |
| Multi-trip Challenge | Transaction Bonus Promotion | Batch Promotion : Recurring Transaction Promotion | Promotional Activation |
| Fixed Point | Transaction Product Value Bonus Promotion | Transaction Product Value Bonus Promotion | Promotional Activation |
| Fixed Point | Transaction Product Quantity Bonus Promotion | Transaction Product Quantity Bonus Promotion | Promotional Activation |
| Fixed Point | Transaction Product Bonus Promotion | Transaction Product Bonus Promotion | Promotional Activation |
| Fixed Point | Transaction Bonus Promotion | Batch Promotion : Fixed Point Back | Promotional Activation |
| Fixed Point | Choice Reward & Internet Message Promotion | Batch Promotion : Fixed Point Back | Choice Rewards |
| Fixed Point | No Rule segment & Activation Only | Transaction Bonus Promotion | Promotional Activation |
| Activation Only - Tier upgrade | Transaction Bonus Promotion | Transaction Bonus Promotion | Promotional Activation |
| Activation Only - Points upload | Transaction Bonus Promotion | Manual Batch Upload : Earned | Promotional Activation |
| Limited Time Bonus | Choice Reward & Internet Message Promotion | Interaction Bonus Promotion & FPB Promo | Choice Rewards |
| Limited Time Bonus | Transaction Bonus Promotion | Transaction Bonus Promotion | Promotional Activation |
| IMP only | N/A | Internet Message Promotion | N/A |
| Points donations | Transaction Bonus Promotion | Batch Promotion : Batch Reward Promotion | Promotional Activation |
| Extra Entries | Transaction Bonus Promotion | Batch Promotion : Batch Reward Promotion | Promotional Activation |
| Salon cert | N/A | Promo Segments & Internet Message Promotion | N/A |
| Benefit - Choose 2X | Transaction Bonus Promotion | Transaction Bonus Promotion | Promotional Activation |
| Interactions | Transaction Bonus Promotion | Interaction Bonus Promotion | N/A |
| To Discuss | To Discuss | To Discuss | To Discuss |

---
## Appendix F. Deactivation code rules

- Deactivation Ref ID : MMYYD#K#
- MM = month number
- YY = year number
- Donation = "D"
- TRG = Gift card Giveaway = “G”
- TRSG Extra Entries = “E”
- Partner offers = “P”
- Wildcard / other = “X”
- #K# = changes depending on the amount of the offer, where 1000=1K, 1,500=1K5, 5,000 = 5K

---
## Appendix G. Databricks metadata mapping summary

`metadataFields.json` has 169 columns: 101 metadata attributes (MA), 54 calculated metrics (CM), 14 unclassified. 121 map to a form field or a `calc.*` value; the rest display "Not captured in the calendar form" in the Data Feed preview (these are mostly metrics or fields built outside the calendar today).


---
## Appendix H. Kickoff prompt for Claude Code

Paste this into Claude Code from the project folder that contains this spec and the `/data` folder:

```
You are building a front-end-only clickable prototype called "Loyalty Offer Manager".
Read PROTOTYPE_SPEC.md completely and every JSON file in /data before writing any code.
Follow the build plan in section 13 milestone by milestone. After each milestone, run
the app, check it against the acceptance checklist in section 14, and tell me what is done.
Rules:
- Every field, dropdown value and tooltip must come from /data. Do not invent any.
- No backend. Persist state in localStorage via Zustand persist. Provide "Reset demo data".
- Implement calculations exactly as in section 8, validation as in section 9,
  visibility as in section 10, lifecycle guards as in section 7.3.
- Mark "(proposed rule)" items with a visible info icon and "Phase 2" items with a badge.
- Write Vitest unit tests for calculations using the worked checks in section 14.
Start with milestone 1 and show me the project structure before moving on.
```
