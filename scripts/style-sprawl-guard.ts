import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');

const allowedRootCss = new Set([
  'globals.css',
  'release-polish.css',
]);

const legacyRootCss = new Set([
  'everitt-theme.css','everitt-app-polish.css','everitt-editorial-fixes.css','typography.css','nav.css','outbound.css','feedback-toast.css','everitt-luxury-refresh.css','app-readability-pass.css','customer-ready-polish.css','dashboard.css','job-mobile-fixes.css','payment-receipt-modal-fix.css','job-visit-layout-override.css','form-alignment-fixes.css','jobs-visual-polish.css','mobile-safe-areas.css','receipt.css','mobile-usability-fixes.css','everitt-modern-refresh.css','text-contrast.css','contractor-portal.css','native-tablet-release-polish.css','everitt-visual-system.css','final-layout-guard.css','jobs-visual-final.css','jobs-actions-spacing-fix.css','unified-record-cards.css','team-customer-consistency.css','button-consistency.css','final-app-polish.css','final-overlay-polish.css','final-compact-controls-polish.css','final-language-layout-polish.css','sidebar-plan-card-polish.css','navigation-visibility-guard.css','minimal-release-polish.css','role-dashboard-v1.css','jobs-owner-minimal.css','final-record-card-consistency.css','portal-role-consistency.css','mobile-overflow-final-fix.css','contractor-outlook-label-fix.css','dashboard-responsive-fit.css','job-form-spacing-final.css','cross-role-alignment-final.css','settings-card-spacing-final.css','notification-settings-layout-fix.css','final-release-polish.css','owner-job-card-mobile-alignment.css','jobs-filter-mobile-alignment.css','job-guidance-editorial.css','page-top-control-consistency.css','pricing-helper.css','native-app-topbar-final.css','boxed-content-spacing-final.css','quotes-sidebar-alignment-final.css','ask-everitt-overlay-fix.css','linkedin-mobile-refresh.css','hero-background-visibility.css','desktop-auth-contrast.css'
]);

function rootCssFiles() {
  return readdirSync(APP).filter((name) => name.endsWith('.css') && statSync(join(APP, name)).isFile());
}

const css = rootCssFiles();
const unexpected = css.filter((name) => !allowedRootCss.has(name) && !legacyRootCss.has(name));

if (unexpected.length) {
  console.error('\nNew root-level CSS files are blocked during the sell-ready freeze.');
  console.error('Put new shared rules in app/release-polish.css or edit the owning existing stylesheet.');
  console.error('Unexpected files:');
  for (const file of unexpected) console.error(`  - ${relative(ROOT, join(APP, file))}`);
  process.exit(1);
}

console.log(`Style guard passed. ${legacyRootCss.size} legacy root CSS files are frozen; new shared work belongs in app/release-polish.css.`);
