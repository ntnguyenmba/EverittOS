# Jobs list harvest

Freeze SHA: `8492e688`
Guard SHA: `6d9918c`
Surface: owner Jobs list (`app/jobs/page.tsx`)
Do not delete overlays in this step. Do not shrink `app/globals.css` in this step.

## What actually wins today

`app/layout.tsx` loads 31 global sheets. Later files beat earlier ones.
Jobs-specific unused overlays exist on disk but are **not** imported by layout, so they already do nothing in production.

### Loaded and winning on Jobs

| File | Role on Jobs |
| --- | --- |
| `globals.css` | Base tokens, `.btn`, cards, tables. Keep. Do not edit in harvest PR. |
| `typography.css` | Type scale. Keep. |
| `signed-in-canvas.css` | Signed-in page width / padding. Keep while harvesting. |
| `jobs-filter-mobile-alignment.css` | Mobile header grid, New Job / Export / Cleanup, filter tabs, filter selects. **Winning geometry.** |
| `jobs-mobile-layout-hotfix.css` | Mobile row / table wrap / overflow. Keep while harvesting. |
| `job-card-spacing.css` | Shared card rhythm: identity → actions → money. 44px tap targets. Keep. |
| `box-stack-spacing.css` | Vertical stack gaps. Keep. |
| `final-layout-guard.css` | Last-ish layout lock. Keep until primitives replace it. |
| `view-center-final.css` | Caps `.jobs-list-page` / `.jobs-shell-minimal` to `--eo-view-max`. Keep. |
| `form-alignment-fixes.css` | Also styles `.jobs-shell-minimal`. Treat as keep-until-harvested. |

### On disk, not in layout — already dead on Jobs

These can be deleted **after one week on the freeze tag**. Stopping the import is already done.

- `jobs-visual-polish.css`
- `jobs-visual-final.css`
- `jobs-mobile-editorial-final.css`
- `jobs-actions-spacing-fix.css`
- `jobs-owner-minimal.css`
- `jobs-owner-v1.css`
- `job-mobile-fixes.css`
- `owner-job-card-mobile-alignment.css`

Do not re-import them to "see if they look better." That is how the cascade broke.

## Controls that must stay visible

Harvest is failed if any of these move off-screen, drop below 44px, or get `display:none` from a global rule:

- New Job
- Export
- Duplicate cleanup
- Filter tabs
- Advanced filter selects
- Clear filters
- Row menu / Start / Finish on a job row

## Copy these rules into primitives (not new overlays)

From `jobs-filter-mobile-alignment.css` (mobile ≤760px):

- header is a column; title full width left
- `.jobs-header-actions` is a 2-col × 2-row 48px grid; primary action on row 1 full width
- ≤350px: stack all three header actions
- filter tabs are pills, height 36px, wrap
- filter grid is one column; selects 48px high
- filter labels are visually hidden, not removed from the DOM

From `job-card-spacing.css`:

- `--job-label-gap: 4px`
- `--job-block-gap: 16px`
- `--job-action-gap: 22px` (20px under 700px)
- `--job-button-gap: 12px` (10px under 700px)
- `--job-card-pad: 22px` (20px under 700px)
- buttons inside job cards: `min-height: 44px`

Land those values in `app/design/tokens.css`.
Land the structure classes in `app/design/primitives.css` as `.eo-card`, `.eo-btn`, `.eo-list-row`, `.eo-field`, `.eo-status`.
Do not add `!important` in primitives unless a frozen overlay still fights them. Prefer switching the Jobs page to primitive classes, then drop the overlay import.

## PR sequence (one surface only)

1. Tag `8492e688` as `everitt-visual-freeze-2026-08-30` if not already tagged.
2. This commit: harvest map + empty-safe tokens/primitives. Look must not change.
3. Next PR: copy winning Jobs values into tokens/primitives. Still do not delete files.
4. Next PR: point Jobs markup at primitive classes. Run job-flow tests.
5. If New Job / filters / Start still work for a week, delete the dead overlay files listed above.
6. Only then stop importing `jobs-filter-mobile-alignment.css` and `jobs-mobile-layout-hotfix.css`.

Dashboard cards are surface two. Do not start them until Jobs step 4 is green.
