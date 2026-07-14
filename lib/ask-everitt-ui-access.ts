import { isNativePlatform } from '@/lib/platform/detect';
import { resolveBillingVisibility } from '@/lib/platform/billing';

export type AskEverittAccessStatus = {
  searchAvailable?: boolean | null;
  aiModeAvailable?: boolean | null;
  aiLocked?: boolean | null;
  planLocked?: boolean | null;
};

export type AskEverittUiAccess = {
  isNative: boolean;
  canUseWorkspaceSearch: boolean;
  canUseAi: boolean;
  shouldShowAiControls: boolean;
  shouldShowAiUpsell: boolean;
  shouldShowAiSuggestions: boolean;
  unavailableMessage: string;
};

/** Derive Ask Everitt UI rules for web vs Capacitor native shells. */
export function resolveAskEverittUiAccess(status?: AskEverittAccessStatus | null): AskEverittUiAccess {
  const isNative = isNativePlatform();
  const canUseWorkspaceSearch = status?.searchAvailable !== false;
  const canUseAi = status?.aiModeAvailable === true;
  const shouldShowAiControls = canUseAi;
  const shouldShowAiUpsell = !isNative && !canUseAi;
  const shouldShowAiSuggestions = canUseAi;

  return {
    isNative,
    canUseWorkspaceSearch,
    canUseAi,
    shouldShowAiControls,
    shouldShowAiUpsell,
    shouldShowAiSuggestions,
    unavailableMessage: 'This feature is unavailable for this account.'
  };
}

/** Native shells must never open billing/upgrade UI from Ask Everitt. */
export function shouldOpenAskEverittUpgrade(status?: AskEverittAccessStatus | null): boolean {
  const access = resolveAskEverittUiAccess(status);
  const billing = resolveBillingVisibility();
  return access.shouldShowAiUpsell && billing.showUpgradeActions;
}
