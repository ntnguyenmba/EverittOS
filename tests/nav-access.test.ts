import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appNavItemsForRole,
  billingUpgradeHref,
  canAccessNavHref,
  canAccessSettingsPath,
  canShowNavHref,
  isNavLinkActive,
  resolveNavItem,
  settingsLinksForRole
} from '@/lib/nav-access';
import {
  isClientAllowedPath,
  isContractorAllowedPath,
  settingsHomeForRole
} from '@/lib/portal-access';
import { normalizeRole } from '@/lib/roles';
import { defaultPathForRole } from '@/lib/role-routes';

describe('role normalization', () => {
  it('maps known aliases through one central function', () => {
    assert.equal(normalizeRole('Owner'), 'owner');
    assert.equal(normalizeRole('staff'), 'employee');
    assert.equal(normalizeRole('crew_lead'), 'contractor');
    assert.equal(normalizeRole('client'), 'client');
  });
});

describe('navigation visibility by role', () => {
  it('owner sees organization routes', () => {
    assert.equal(canShowNavHref('owner', '/dashboard'), true);
    assert.equal(canShowNavHref('owner', '/customers'), true);
    assert.equal(canShowNavHref('owner', '/invoices'), true);
    assert.equal(canShowNavHref('owner', '/analytics'), true);
    assert.equal(canShowNavHref('owner', '/settings/billing'), true);
    assert.equal(canShowNavHref('owner', '/settings/integrations'), true);
    assert.equal(canAccessNavHref('owner', '/dashboard', 'business'), true);
  });

  it('manager sees operational routes but not billing or payments', () => {
    assert.equal(canShowNavHref('manager', '/dashboard'), true);
    assert.equal(canShowNavHref('manager', '/jobs'), true);
    assert.equal(canShowNavHref('manager', '/customers'), true);
    assert.equal(canShowNavHref('manager', '/leads'), true);
    assert.equal(canShowNavHref('manager', '/people'), true);
    assert.equal(canShowNavHref('manager', '/invoices'), false);
    assert.equal(canShowNavHref('manager', '/settings/billing'), false);
    assert.equal(canShowNavHref('manager', '/settings/integrations'), false);
    assert.equal(canShowNavHref('manager', '/analytics'), false);
    assert.equal(canAccessSettingsPath('manager', '/settings/billing', 'business'), false);
    assert.equal(canAccessSettingsPath('manager', '/settings/account', 'business'), true);
  });

  it('contractor sees only contractor portal navigation', () => {
    assert.equal(canShowNavHref('contractor', '/portal/contractor'), true);
    assert.equal(canShowNavHref('contractor', '/portal/contractor/settings'), true);
    assert.equal(canShowNavHref('contractor', '/settings/account'), true);
    assert.equal(canShowNavHref('contractor', '/knowledge'), false);
    assert.equal(canShowNavHref('contractor', '/invoices'), false);
    assert.equal(canShowNavHref('contractor', '/customers'), false);
    assert.equal(canShowNavHref('contractor', '/dashboard'), false);
    assert.equal(canShowNavHref('contractor', '/analytics'), false);
    assert.equal(canAccessNavHref('contractor', '/portal/contractor', 'free'), true);

    const items = appNavItemsForRole('contractor', 'free');
    assert.equal(
      items.some((item) => item.href === '/knowledge' || item.href === '/invoices' || item.href === '/customers' || item.href === '/analytics'),
      false
    );
  });

  it('customer sees only customer portal navigation', () => {
    assert.equal(canShowNavHref('client', '/portal/client'), true);
    assert.equal(canShowNavHref('client', '/portal/client/settings'), true);
    assert.equal(canShowNavHref('client', '/team'), false);
    assert.equal(canShowNavHref('client', '/analytics'), false);
    assert.equal(canShowNavHref('client', '/people'), false);
    assert.equal(canAccessNavHref('client', '/portal/client', 'free'), true);
  });
});

describe('settings links by role', () => {
  it('returns personal settings for portal roles and owner settings for owners', () => {
    const contractorLinks = settingsLinksForRole('contractor', 'growth');
    assert.ok(contractorLinks.some((link) => link.href === '/settings/account'));
    assert.equal(contractorLinks.some((link) => link.href === '/settings/billing'), false);

    const clientLinks = settingsLinksForRole('client', 'growth');
    assert.ok(clientLinks.some((link) => link.href === '/settings/account'));
    assert.equal(clientLinks.some((link) => link.href === '/settings/integrations'), false);

    const ownerLinks = settingsLinksForRole('owner', 'business');
    assert.ok(ownerLinks.some((link) => link.href === '/settings/billing'));
    assert.equal(ownerLinks.some((link) => link.href === '/settings/integrations'), false);
    assert.ok(ownerLinks.some((link) => link.href === '/settings/account'));
    assert.ok(ownerLinks.some((link) => link.href === '/settings'));

    const managerLinks = settingsLinksForRole('manager', 'business');
    assert.equal(managerLinks.some((link) => link.href === '/settings/billing'), false);
    assert.equal(managerLinks.some((link) => link.href === '/settings/integrations'), false);
    assert.ok(managerLinks.some((link) => link.href === '/settings/account'));
    assert.ok(managerLinks.some((link) => link.href === '/settings/notifications'));
  });

  it('owner primary nav is slim without Invoices or Payments', () => {
    const items = appNavItemsForRole('owner', 'business');
    const hrefs = items.map((item) => item.href);
    assert.deepEqual(hrefs, [
      '/dashboard',
      '/jobs',
      '/schedule',
      '/customers',
      '/people',
      '/expenses',
      '/bookkeeping',
      '/knowledge',
      '/settings'
    ]);
    assert.equal(items.some((item) => /invoice|payment/i.test(item.label)), false);
  });

  it('manager primary nav excludes Invoices and Payments', () => {
    const items = appNavItemsForRole('manager', 'business');
    const hrefs = items.map((item) => item.href);
    assert.deepEqual(hrefs, [
      '/dashboard',
      '/jobs',
      '/schedule',
      '/customers',
      '/people',
      '/expenses',
      '/bookkeeping',
      '/knowledge',
      '/settings'
    ]);
    assert.equal(items.some((item) => /invoice|payment/i.test(item.label)), false);
  });
});

describe('route landing and portal path helpers', () => {
  it('lands each role on the correct home', () => {
    assert.equal(defaultPathForRole('owner', '/dashboard'), '/dashboard');
    assert.equal(defaultPathForRole('manager', '/dashboard'), '/dashboard');
    assert.equal(defaultPathForRole('contractor', '/dashboard'), '/portal/contractor');
    assert.equal(defaultPathForRole('contractor', '/invoices'), '/portal/contractor');
    assert.equal(defaultPathForRole('contractor', '/portal/contractor/settings'), '/portal/contractor/settings');
    assert.equal(defaultPathForRole('client', '/customers'), '/portal/client');
    assert.equal(defaultPathForRole('client', '/portal/client'), '/portal/client');
  });

  it('allows only portal-safe contractor and client paths', () => {
    assert.equal(isContractorAllowedPath('/portal/contractor'), true);
    assert.equal(isContractorAllowedPath('/portal/contractor/settings'), true);
    assert.equal(isContractorAllowedPath('/settings/account'), true);
    assert.equal(isContractorAllowedPath('/jobs/abc'), true);
    assert.equal(isContractorAllowedPath('/knowledge'), false);
    assert.equal(isContractorAllowedPath('/knowledge/playbook-1'), false);
    assert.equal(isContractorAllowedPath('/invoices'), false);
    assert.equal(isContractorAllowedPath('/customers'), false);

    assert.equal(isClientAllowedPath('/portal/client'), true);
    assert.equal(isClientAllowedPath('/portal/client/settings'), true);
    assert.equal(isClientAllowedPath('/portal/client/jobs'), true);
    assert.equal(isClientAllowedPath('/portal/client/jobs/job-1'), true);
    assert.equal(isClientAllowedPath('/team/accept'), true);
    assert.equal(isClientAllowedPath('/team/accept?token=abc'), true);
    assert.equal(isClientAllowedPath('/settings/account'), true);
    assert.equal(isClientAllowedPath('/invoices'), false);
    assert.equal(isClientAllowedPath('/team'), false);
    assert.equal(isContractorAllowedPath('/team/accept'), true);

    assert.equal(settingsHomeForRole('contractor'), '/portal/contractor/settings');
    assert.equal(settingsHomeForRole('client'), '/portal/client/settings');
    assert.equal(settingsHomeForRole('owner'), '/settings/account');
  });
});

describe('nav helper utilities', () => {
  it('keeps required exports working', () => {
    assert.ok(billingUpgradeHref('pro', 'Bookings').includes('/settings/billing'));
    assert.equal(isNavLinkActive('/settings/account', '/settings'), false);
    assert.equal(isNavLinkActive('/settings', '/settings'), true);
    assert.equal(resolveNavItem('contractor', 'free', '/portal/contractor').accessible, true);
    assert.equal(resolveNavItem('manager', 'business', '/settings/billing').visible, false);
  });
});
