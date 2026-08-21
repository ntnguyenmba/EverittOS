export type MarketSource = {
  country: string;
  countryCode: string;
  source: string;
  sourceType: 'official_wage' | 'price_index' | 'platform' | 'consumer_guide' | 'operator_benchmark' | 'fallback';
  rank: number;
  currency: string;
  url: string;
  updatedAt?: string;
  low?: number;
  high?: number;
  value?: number;
  unit?: string;
  note?: string;
};

export const MARKET_SOURCES: MarketSource[] = [
  {
    country: 'United States', countryCode: 'US', source: 'U.S. Bureau of Labor Statistics / FRED residential cleaning PPI', sourceType: 'price_index', rank: 1, currency: 'USD',
    url: 'https://fred.stlouisfed.org/series/PCU56172056172052', updatedAt: '2026-08-13', value: 177.538, unit: 'Index Jun 2003=100',
    note: 'Official cost trend reference. It is not a local customer price range.'
  },
  { country: 'United States', countryCode: 'US', source: 'BLS OEWS, Maids and Housekeeping Cleaners', sourceType: 'official_wage', rank: 1, currency: 'USD', url: 'https://www.bls.gov/oes/current/oes372012.htm', note: 'Official wage foundation. Metro detail should be preferred when available.' },
  { country: 'United Kingdom', countryCode: 'GB', source: 'Office for National Statistics, ASHE', sourceType: 'official_wage', rank: 1, currency: 'GBP', url: 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours', note: 'Official wage foundation.' },
  { country: 'Canada', countryCode: 'CA', source: 'Statistics Canada labour and wage data', sourceType: 'official_wage', rank: 1, currency: 'CAD', url: 'https://www.statcan.gc.ca/', note: 'Official wage foundation.' },
  { country: 'Australia', countryCode: 'AU', source: 'Australian Bureau of Statistics labour and earnings data', sourceType: 'official_wage', rank: 1, currency: 'AUD', url: 'https://www.abs.gov.au/', note: 'Official wage foundation.' },
  { country: 'European Union', countryCode: 'EU', source: 'Eurostat earnings and labour cost data', sourceType: 'official_wage', rank: 1, currency: 'EUR', url: 'https://ec.europa.eu/eurostat/', note: 'EU foundation. National statistical offices should be preferred when available.' },
  { country: 'Vietnam', countryCode: 'VN', source: 'Vietnam Decree 293/2025/ND-CP, Region I minimum hourly wage', sourceType: 'official_wage', rank: 1, currency: 'VND', url: 'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939', updatedAt: '2026-01-01', value: 25500, unit: 'VND/hour', note: 'Legal floor only for covered employment, not a market cleaning rate.' },
  { country: 'Vietnam', countryCode: 'VN', source: 'Vietnam Decree 293/2025/ND-CP, Region II minimum hourly wage', sourceType: 'official_wage', rank: 1, currency: 'VND', url: 'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939', updatedAt: '2026-01-01', value: 22700, unit: 'VND/hour', note: 'Legal floor only for covered employment.' },
  { country: 'Vietnam', countryCode: 'VN', source: 'Vietnam Decree 293/2025/ND-CP, Region III minimum hourly wage', sourceType: 'official_wage', rank: 1, currency: 'VND', url: 'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939', updatedAt: '2026-01-01', value: 20000, unit: 'VND/hour', note: 'Legal floor only for covered employment.' },
  { country: 'Vietnam', countryCode: 'VN', source: 'Vietnam Decree 293/2025/ND-CP, Region IV minimum hourly wage', sourceType: 'official_wage', rank: 1, currency: 'VND', url: 'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939', updatedAt: '2026-01-01', value: 17800, unit: 'VND/hour', note: 'Legal floor only for covered employment.' },
  { country: 'Global', countryCode: 'GLOBAL', source: 'International Labour Organization wage data', sourceType: 'fallback', rank: 10, currency: 'USD', url: 'https://www.ilo.org/', note: 'Global fallback when a stronger national source is unavailable.' }
];

export const MARKET_COUNTRIES = [
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'EU', label: 'European Union', currency: 'EUR' },
  { code: 'VN', label: 'Vietnam', currency: 'VND' },
  { code: 'GLOBAL', label: 'Other / Global', currency: 'USD' }
] as const;

export function marketSourcesForCountry(countryCode: string) {
  const code = String(countryCode || 'GLOBAL').toUpperCase();
  const exact = MARKET_SOURCES.filter((source) => source.countryCode === code).sort((a, b) => a.rank - b.rank);
  return exact.length ? exact : MARKET_SOURCES.filter((source) => source.countryCode === 'GLOBAL');
}
