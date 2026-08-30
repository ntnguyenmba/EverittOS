# Jobs list harvest

Freeze SHA: `8492e688`
Guard SHA: `6d9918c`
Surface: owner Jobs list (`app/jobs/page.tsx`)
Do not delete overlays in this step. Do not shrink `app/globals.css` in this step.

## Status

- [x] 1. Harvest map
- [x] 2. Empty-safe tokens/primitives imported after globals (look unchanged)
- [x] 3. Winning Jobs numbers in `app/design/tokens.css`
- [x] 4. Winning Jobs geometry in `app/design/primitives.css` (`.eo-*` only)
- [ ] 5. Jobs markup opts into primitive classes *in addition to* frozen selectors
- [ ] 6. Job-flow tests stay green for a week (New Job / Export / Cleanup / filters / row menu)
- [ ] 7. Delete dead overlay files listed below
- [ ] 8. Stop importing `jobs-filter-mobile-alignment.css` and `jobs-mobile-layout-hotfix.css`

Dashboard cards are surface two. Do not start them until step 6 is green.

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

## Primitive map (next markup PR)

Add these classes next to the frozen selectors. Do not remove the frozen selectors yet.

| Frozen selector | Primitive class to add |
| --- | --- |
| `.jobs-list-page` | `.eo-chrome` |
| `.jobs-header-actions` | `.eo-action-grid` |
| `.btn` on header / clear / show-more | `.eo-btn` |
| `.jobs-filter-tab` | `.eo-status` |
| filter `<select>` | `.eo-field` |
| `.card.jobs-table-card` | `.eo-card` |
| `.jobs-operations-row` | `.eo-list-row` |
| `.jobs-menu-trigger` | `.eo-btn` |

Overlays still win on the frozen selectors. Primitive classes are additive so dropping an overlay later does not leave the surface unstyled.
Keep filter label `<span>`s in the DOM. The overlay already visually hides them on mobile.
