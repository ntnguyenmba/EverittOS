# EverittOS visual freeze

Snapshot: `8492e688` on `main` (2026-08-30).
Tag this commit as `everitt-visual-freeze-2026-08-30` before deleting any stylesheet.

The product is not missing another look. It is missing a single design system.
`app/globals.css` is ~108KB. It sits under 80+ overlay files named final / polish / hotfix / guard / refresh / last. Later files win by accident. Fixing Jobs can hide Dashboard controls.

## Rules

Allowed after this freeze:

- `app/design/tokens.css` (color, type, space, radius, z, safe-area)
- `app/design/primitives.css` (chrome, card, button, list-row, field, status-pill)
- page-local CSS modules for structure only
- regression tests for job flow, payments, filters, role switch, PIN, photos

Forbidden:

- a new `*-final.css`, `*-polish.css`, `*-hotfix.css`, `*-guard.css`, `*-refresh.css`, `*-last.css`
- new root files under `app/*.css` except the two design files above
- runtime style rewriting
- global `!important` that moves or hides functional controls
- visual work on a PIN / billing / Capacitor / photos PR

Do not hide or reposition New Job, Save, Start, Finish, filters, role switch, PIN, or photo controls with a global override.

## What is loaded today

`app/layout.tsx` loads these, in order. That order *is* the current look. Do not prepend or append another global overlay.

1. `globals.css`
2. `design/tokens.css`
3. `design/primitives.css`
4. `everitt-theme.css`
5. `typography.css`
6. `nav.css`
7. `outbound.css`
8. `feedback-toast.css`
9. `dashboard.css`
10. `form-alignment-fixes.css`
11. `job-visit-layout-override.css`
12. `payment-receipt-modal-fix.css`
13. `receipt.css`
14. `mobile-safe-areas.css`
15. `contractor-portal.css`
16. `quote-workspace.css`
17. `role-home-structure.css`
18. `signed-in-canvas.css`
19. `jobs-filter-mobile-alignment.css`
20. `jobs-mobile-layout-hotfix.css`
21. `word-spacing-fix.css`
22. `top-chrome-align.css`
23. `ask-everitt-overlay-fix.css`
24. `job-card-spacing.css`
25. `one-nav.css`
26. `box-stack-spacing.css`
27. `signed-in-stability.css`
28. `hero-last.css`
29. `visual-unify.css`
30. `readability-last.css`
31. `everitt-login-look.css`
32. `final-layout-guard.css`
33. `view-center-final.css`

Files that exist under `app/` but are not in this list are still frozen. Do not add more of them. Harvest, then stop importing, then delete.

`scripts/ui-polish-audit.ts` freezes the import list above, plus the two design files.

## Jobs list — first harvest surface

Full keep / drop / copy list: `JOBS-HARVEST.md`.

Winning files on Jobs (later imports beat earlier ones):

- keep while harvesting: `globals.css`, `typography.css`, `signed-in-canvas.css`, `jobs-filter-mobile-alignment.css`, `jobs-mobile-layout-hotfix.css`, `job-card-spacing.css`, `box-stack-spacing.css`, `final-layout-guard.css`
- already unused by layout — delete after a week on the freeze tag: `jobs-visual-polish.css`, `jobs-visual-final.css`, `jobs-mobile-editorial-final.css`, `jobs-actions-spacing-fix.css`, `jobs-owner-minimal.css`, `jobs-owner-v1.css`, `job-mobile-fixes.css`, `owner-job-card-mobile-alignment.css`

Method:

1. Tag the freeze SHA.
2. Record computed styles for one job row, the filter bar, and primary actions (mobile + desktop).
3. Copy only the winning rules into tokens + card / button / field primitives.
4. Stop importing the drop list. Do not shrink `globals.css` in the same PR.
5. Run job-flow tests. If Start / filters / New Job move or vanish, revert.
6. Delete unused overlays only after a full week on the freeze tag.

Dashboard cards are the second surface. Same method. Not a parallel redesign.

## Infrastructure stay-out list

Leave these alone in a visual PR: Capacitor plugins, native PIN / biometric, Stripe, RLS, photo upload routes, worker / client guards.

## Gate

`npm run ui:style-sprawl` must stay in `npm run verify`.
A visual PR is not done unless New Job, Save, Start, Finish, payments, filters, role switch, PIN, and photos still work.
