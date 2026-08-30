import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');
const DESIGN = join(APP, 'design');

/** Existing root stylesheets as of the 2026-08-30 freeze. No new app/*.css files. */
const frozenRootCss = new Set([
  'app-readability-pass.css',
  'app-wide-editorial-final.css',
  'ask-everitt-overlay-fix.css',
  'bookkeeping.css',
  'box-stack-spacing.css',
  'boxed-content-spacing-final.css',
  'button-consistency.css',
  'contractor-field-mode.css',
  'contractor-outlook-label-fix.css',
  'contractor-portal.css',
  'cross-role-alignment-final.css',
  'customer-ready-polish.css',
  'dashboard-card-fit.css',
  'dashboard-final-polish.css',
  'dashboard-metric-responsive-fix.css',
  'dashboard-mobile-alignment.css',
  'dashboard-mobile-balance.css',
  'dashboard-repair.css',
  'dashboard-responsive-fit.css',
  'dashboard-visual-balance.css',
  'dashboard.css',
  'desktop-auth-contrast.css',
  'everitt-app-polish.css',
  'everitt-editorial-fixes.css',
  'everitt-login-look.css',
  'everitt-luxury-refresh.css',
  'everitt-modern-refresh.css',
  'everitt-theme.css',
  'everitt-visual-system.css',
  'feedback-toast.css',
  'final-app-polish.css',
  'final-compact-controls-polish.css',
  'final-cross-role-header-controls.css',
  'final-language-layout-polish.css',
  'final-layout-guard.css',
  'final-overlay-polish.css',
  'final-record-card-consistency.css',
  'final-release-polish.css',
  'footer-bottom-nav-clearance.css',
  'footer-contrast-final.css',
  'form-alignment-fixes.css',
  'globals.css',
  'hero-background-visibility.css',
  'hero-last.css',
  'job-card-spacing.css',
  'job-form-spacing-final.css',
  'job-guidance-editorial.css',
  'job-instructions-context-link.css',
  'job-mobile-fixes.css',
  'job-visit-layout-override.css',
  'jobs-actions-spacing-fix.css',
  'jobs-filter-mobile-alignment.css',
  'jobs-mobile-editorial-final.css',
  'jobs-mobile-layout-hotfix.css',
  'jobs-owner-minimal.css',
  'jobs-owner-v1.css',
  'jobs-visual-final.css',
  'jobs-visual-polish.css',
  'linkedin-mobile-refresh.css',
  'login-match-visual.css',
  'marketing-home.css',
  'mobile-overflow-final-fix.css',
  'mobile-readability-and-footer-final.css',
  'mobile-safe-areas.css',
  'mobile-usability-fixes.css',
  'native-app-readability-2026.css',
  'native-app-topbar-final.css',
  'native-tablet-release-polish.css',
  'nav.css',
  'navigation-visibility-guard.css',
  'notification-settings-layout-fix.css',
  'one-nav.css',
  'outbound.css',
  'owner-job-card-mobile-alignment.css',
  'page-top-control-consistency.css',
  'payment-receipt-modal-fix.css',
  'portal-role-consistency.css',
  'post-login-surface-consistency.css',
  'post-login-visual-unification.css',
  'pricing-helper.css',
  'quote-workspace.css',
  'quotes-sidebar-alignment-final.css',
  'readability-last.css',
  'receipt.css',
  'release-polish.css',
  'role-dashboard-v1.css',
  'role-home-structure.css',
  'settings-card-spacing-final.css',
  'sidebar-plan-card-polish.css',
  'signed-in-canvas.css',
  'signed-in-stability.css',
  'team-access-hide.css',
  'team-customer-consistency.css',
  'text-contrast.css',
  'top-chrome-align.css',
  'typography.css',
  'unified-record-cards.css',
  'unified-spacing-final.css',
  'view-center-final.css',
  'visual-unify.css',
  'word-spacing-fix.css',
]);

const allowedDesignCss = new Set(['tokens.css', 'primitives.css']);

const bannedName = /(final|polish|hotfix|guard|refresh|last|overlay-fix|repair|alignment-final)/i;

function listCss(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.css') && statSync(join(dir, name)).isFile());
  } catch {
    return [];
  }
}

const failures: string[] = [];

const rootCss = listCss(APP);
const unexpectedRoot = rootCss.filter((name) => !frozenRootCss.has(name));
if (unexpectedRoot.length) {
  failures.push('New root-level CSS is blocked. Put shared rules in app/design/tokens.css or app/design/primitives.css.');
  for (const file of unexpectedRoot) failures.push(`  unexpected: ${relative(ROOT, join(APP, file))}`);
}

const designCss = listCss(DESIGN);
const unexpectedDesign = designCss.filter((name) => !allowedDesignCss.has(name));
if (unexpectedDesign.length) {
  failures.push('Only tokens.css and primitives.css are allowed under app/design/.');
  for (const file of unexpectedDesign) failures.push(`  unexpected: ${relative(ROOT, join(DESIGN, file))}`);
}

for (const file of unexpectedRoot.concat(unexpectedDesign)) {
  if (bannedName.test(file)) {
    failures.push(`Banned overlay name: ${file}`);
  }
}

if (failures.length) {
  console.error('\nStyle freeze failed. See STABILIZATION.md.');
  for (const line of failures) console.error(line);
  process.exit(1);
}

console.log(
  `Style freeze passed. ${frozenRootCss.size} root CSS files are frozen; new shared work belongs in app/design/tokens.css or primitives.css.`,
);
