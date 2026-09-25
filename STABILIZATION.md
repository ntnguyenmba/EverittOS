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

## Where things live now (2026-09-25)

- `app/design/tokens.css` is the only place `:root` design tokens are defined,
  including the compatibility aliases (`--accent`, `--line`, `--bg`, …) and the
  backdrop (`--eo-shell-*`). Other stylesheets must not redefine them.
- `app/design/primitives.css` owns:
  - `.eo-backdrop`: the hero.jpg background, mounted once by
    `components/app-backdrop.tsx` in the root layout. Tune it with the
    `--eo-shell-*` tokens only.
  - shell geometry: `.dashboard-shell`, `.dashboard-shell-header` (sticky, in
    flow), `.dashboard-shell > .main`, `.app-page-content`, `.app-page-stage`,
    and the footer width. No other file may set their width, padding,
    position, or background.
  - page surfaces: each section inside the stage floats as its own card;
    wrappers of cards stay transparent. Use `.eo-bare` to opt a section out.
  - the shared `:focus-visible` ring.
- Document pages (`main.eo-document`: legal, help, pricing) are an explicit variant
  that hides the backdrop.

`app/layout.tsx` still loads the 19 stylesheets checked by
`scripts/ui-polish-audit.ts`. The 69 unloaded overlay files and the seven
`dashboard-*` sub-files were deleted on 2026-09-25 (the latter inlined into
`dashboard.css` in order). `scripts/style-sprawl-guard.ts` lists the 18 root
stylesheets that remain; the list may only shrink.

## Jobs list — first harvest surface (historical)

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

## Standing spacing rule

Keep healthy responsive space everywhere: no cards or controls pressed against viewport edges, no sections jammed together, no text touching borders or controls, and no excessively wide or cramped content columns. Use the centralized `--eo-gutter`, `--eo-section-gap`, `--eo-card-padding`, `--eo-control-gap`, and `--eo-view-max` tokens instead of page-specific spacing overrides.

**Box-edge rule:** every visible card, panel, boxed header, modal, form surface, record surface, and similar bordered/rounded container must keep comfortable internal padding between its border and all wording, icons, badges, and controls. Text must never visually start at the same edge as the box border. Use the shared card-padding tokens, with at least 20px horizontal inset on normal app surfaces, and preserve that rule across desktop, tablet, iOS, Android, and 360/390/430px mobile layouts. Do not fix individual screens with one-off padding values; correct the shared primitive/rhythm layer instead.

## 2026-09-25 final stabilization follow-up

`/expenses` now starts with a deterministic server/client form state and fills the local default date after mount, removing the remaining timezone-sensitive hydration path while preserving the local-date default for users.
