'use client';

import { MARKET_COUNTRY_OPTIONS, QUOTE_PROFESSIONS, type MarketSource } from '@/lib/market-context';
import type { PricingHelperSettings } from '@/lib/pricing-helper';

type QuoteMarketHelpProps = {
  settings: PricingHelperSettings;
  paidIntelligence: boolean;
  marketSources: MarketSource[];
  serviceType: string;
  onServiceTypeChange: (value: string) => void;
  onSettingsChange: (next: PricingHelperSettings) => void;
};

const OTHER_VALUE = 'Other';

export function QuoteMarketHelp({
  settings,
  paidIntelligence,
  marketSources,
  serviceType,
  onServiceTypeChange,
  onSettingsChange
}: QuoteMarketHelpProps) {
  const knownProfession = QUOTE_PROFESSIONS.includes(serviceType);
  const selectedProfession = !serviceType ? '' : knownProfession ? serviceType : OTHER_VALUE;

  return (
    <details className="quote-pricing-settings" open>
      <summary>Country, region, and profession</summary>
      <p className="muted">
        {paidIntelligence
          ? 'Public wage and price sources follow the country you set. Profession shapes the quote helper.'
          : 'Basic quote help is available on this plan. Pro unlocks country sources, region, and similar-job history.'}
      </p>
      <div className="form-grid">
        <label>
          Profession / service
          <select
            className="input"
            value={selectedProfession}
            onChange={(event) => {
              const value = event.target.value;
              if (value === OTHER_VALUE) {
                onServiceTypeChange(knownProfession || !serviceType ? '' : serviceType);
                return;
              }
              onServiceTypeChange(value);
            }}
          >
            <option value="">Select profession</option>
            {QUOTE_PROFESSIONS.map((profession) => (
              <option key={profession} value={profession}>
                {profession}
              </option>
            ))}
            <option value={OTHER_VALUE}>Other</option>
          </select>
        </label>
        {selectedProfession === OTHER_VALUE ? (
          <label>
            Custom profession
            <input
              className="input"
              value={knownProfession ? '' : serviceType}
              placeholder="Type your profession or service"
              onChange={(event) => onServiceTypeChange(event.target.value)}
            />
          </label>
        ) : null}
        <label>
          Country
          <select
            className="input"
            value={settings.marketCountryCode || 'US'}
            disabled={!paidIntelligence}
            onChange={(event) => onSettingsChange({ ...settings, marketCountryCode: event.target.value, marketContextEnabled: true })}
          >
            {MARKET_COUNTRY_OPTIONS.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <input
            className="input"
            value={settings.marketRegion}
            disabled={!paidIntelligence}
            onChange={(event) => onSettingsChange({ ...settings, marketRegion: event.target.value })}
          />
        </label>
        <label>
          City
          <input
            className="input"
            value={settings.marketCity}
            disabled={!paidIntelligence}
            onChange={(event) => onSettingsChange({ ...settings, marketCity: event.target.value })}
          />
        </label>
      </div>
      {paidIntelligence && marketSources.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <p className="muted">Public sources for this country</p>
          {marketSources.slice(0, 3).map((source) => (
            <p key={`${source.countryCode}-${source.source}`} className="muted">
              {source.source}
              {source.note ? ` · ${source.note}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </details>
  );
}
