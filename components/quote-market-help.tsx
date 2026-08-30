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

export function QuoteMarketHelp({
  settings,
  paidIntelligence,
  marketSources,
  serviceType,
  onServiceTypeChange,
  onSettingsChange
}: QuoteMarketHelpProps) {
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
          <input
            className="input"
            list="quote-professions"
            value={serviceType}
            onChange={(event) => onServiceTypeChange(event.target.value)}
          />
          <datalist id="quote-professions">
            {QUOTE_PROFESSIONS.map((profession) => (
              <option key={profession} value={profession} />
            ))}
          </datalist>
        </label>
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
