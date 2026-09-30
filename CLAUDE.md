# Project: Loyalty Offer Manager (clickable prototype)
Source of truth: PROTOTYPE_SPEC.md and the JSON files in /data.
Rules:
- Front-end only. No backend, no real APIs. Persist state in localStorage (Zustand persist).
  Provide a "Reset demo data" action.
- Every field, dropdown value and tooltip must come from /data. Never invent fields,
  options or definitions. If something is missing, show a visible "TODO" badge.
- Calculations exactly as spec section 8, validation section 9, visibility section 10,
  lifecycle statuses and guards section 7.2 and 7.3.
- Items marked "(proposed rule)" get a visible info icon. "Phase 2" items get a badge and
  stay non-functional.
- Status never changes automatically; only through user actions.
- Work milestone by milestone (spec section 13). After each milestone: run the app, check
  the relevant items in the acceptance checklist (section 14), summarise what is done,
  and WAIT for my go-ahead before starting the next milestone.
- Use git. Commit after each milestone with a clear message.
- Stack: React 18 + TypeScript + Vite + Tailwind + Zustand + React Router + TanStack Table
  + date-fns + lucide-react. Vitest for unit tests.
- Plain, business-friendly copy. No lorem ipsum. No company logos.
