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

export type MarketCountry = { code: string; label: string; currency: string };

const COUNTRY_ALIASES: Record<string, MarketCountry> = {
  us:{code:'US',label:'United States',currency:'USD'}, usa:{code:'US',label:'United States',currency:'USD'}, 'united states':{code:'US',label:'United States',currency:'USD'}, america:{code:'US',label:'United States',currency:'USD'},
  uk:{code:'GB',label:'United Kingdom',currency:'GBP'}, gb:{code:'GB',label:'United Kingdom',currency:'GBP'}, britain:{code:'GB',label:'United Kingdom',currency:'GBP'}, 'united kingdom':{code:'GB',label:'United Kingdom',currency:'GBP'}, england:{code:'GB',label:'United Kingdom',currency:'GBP'},
  canada:{code:'CA',label:'Canada',currency:'CAD'}, australia:{code:'AU',label:'Australia',currency:'AUD'}, vietnam:{code:'VN',label:'Vietnam',currency:'VND'}, 'viet nam':{code:'VN',label:'Vietnam',currency:'VND'},
  germany:{code:'DE',label:'Germany',currency:'EUR'}, france:{code:'FR',label:'France',currency:'EUR'}, spain:{code:'ES',label:'Spain',currency:'EUR'}, italy:{code:'IT',label:'Italy',currency:'EUR'}, netherlands:{code:'NL',label:'Netherlands',currency:'EUR'}, belgium:{code:'BE',label:'Belgium',currency:'EUR'}, austria:{code:'AT',label:'Austria',currency:'EUR'}, ireland:{code:'IE',label:'Ireland',currency:'EUR'}, portugal:{code:'PT',label:'Portugal',currency:'EUR'}, finland:{code:'FI',label:'Finland',currency:'EUR'}, greece:{code:'GR',label:'Greece',currency:'EUR'},
  sweden:{code:'SE',label:'Sweden',currency:'SEK'}, norway:{code:'NO',label:'Norway',currency:'NOK'}, denmark:{code:'DK',label:'Denmark',currency:'DKK'}, switzerland:{code:'CH',label:'Switzerland',currency:'CHF'}, poland:{code:'PL',label:'Poland',currency:'PLN'}, 'czech republic':{code:'CZ',label:'Czech Republic',currency:'CZK'}, czechia:{code:'CZ',label:'Czechia',currency:'CZK'}, hungary:{code:'HU',label:'Hungary',currency:'HUF'}, romania:{code:'RO',label:'Romania',currency:'RON'},
  japan:{code:'JP',label:'Japan',currency:'JPY'}, china:{code:'CN',label:'China',currency:'CNY'}, 'south korea':{code:'KR',label:'South Korea',currency:'KRW'}, korea:{code:'KR',label:'South Korea',currency:'KRW'}, india:{code:'IN',label:'India',currency:'INR'}, singapore:{code:'SG',label:'Singapore',currency:'SGD'}, malaysia:{code:'MY',label:'Malaysia',currency:'MYR'}, thailand:{code:'TH',label:'Thailand',currency:'THB'}, indonesia:{code:'ID',label:'Indonesia',currency:'IDR'}, philippines:{code:'PH',label:'Philippines',currency:'PHP'}, taiwan:{code:'TW',label:'Taiwan',currency:'TWD'},
  mexico:{code:'MX',label:'Mexico',currency:'MXN'}, brazil:{code:'BR',label:'Brazil',currency:'BRL'}, argentina:{code:'AR',label:'Argentina',currency:'ARS'}, chile:{code:'CL',label:'Chile',currency:'CLP'}, colombia:{code:'CO',label:'Colombia',currency:'COP'}, peru:{code:'PE',label:'Peru',currency:'PEN'},
  'new zealand':{code:'NZ',label:'New Zealand',currency:'NZD'}, 'south africa':{code:'ZA',label:'South Africa',currency:'ZAR'}, 'united arab emirates':{code:'AE',label:'United Arab Emirates',currency:'AED'}, uae:{code:'AE',label:'United Arab Emirates',currency:'AED'}, 'saudi arabia':{code:'SA',label:'Saudi Arabia',currency:'SAR'}, israel:{code:'IL',label:'Israel',currency:'ILS'}, turkey:{code:'TR',label:'Turkey',currency:'TRY'}, türkiye:{code:'TR',label:'Türkiye',currency:'TRY'}
};

const EUROSTAT_COUNTRIES = new Set(['DE','FR','ES','IT','NL','BE','AT','IE','PT','FI','GR']);

export const MARKET_COUNTRY_OPTIONS: MarketCountry[] = Array.from(
  new Map(Object.values(COUNTRY_ALIASES).map((country) => [country.code, country])).values()
).sort((a, b) => a.label.localeCompare(b.label));

export const QUOTE_PROFESSIONS = [
  'Residential cleaning',
  'Deep cleaning',
  'Move-out cleaning',
  'Move-in cleaning',
  'Airbnb / vacation rental cleaning',
  'Office cleaning',
  'Lawn mowing',
  'Landscaping',
  'Handyman',
  'Painting',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Junk removal',
  'Pressure washing'
];

export const MARKET_SOURCES: MarketSource[] = [
  { country:'United States',countryCode:'US',source:'U.S. Bureau of Labor Statistics / FRED residential cleaning PPI',sourceType:'price_index',rank:1,currency:'USD',url:'https://fred.stlouisfed.org/series/PCU56172056172052',updatedAt:'2026-08-13',value:177.538,unit:'Index Jun 2003=100',note:'Official cost trend reference. It is not a local customer price range.' },
  { country:'United States',countryCode:'US',source:'BLS OEWS, Maids and Housekeeping Cleaners',sourceType:'official_wage',rank:1,currency:'USD',url:'https://www.bls.gov/oes/current/oes372012.htm',note:'Official wage foundation. Metro detail should be preferred when available.' },
  { country:'United Kingdom',countryCode:'GB',source:'Office for National Statistics, ASHE',sourceType:'official_wage',rank:1,currency:'GBP',url:'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours',note:'Official wage foundation.' },
  { country:'Canada',countryCode:'CA',source:'Statistics Canada labour and wage data',sourceType:'official_wage',rank:1,currency:'CAD',url:'https://www.statcan.gc.ca/',note:'Official wage foundation.' },
  { country:'Australia',countryCode:'AU',source:'Australian Bureau of Statistics labour and earnings data',sourceType:'official_wage',rank:1,currency:'AUD',url:'https://www.abs.gov.au/',note:'Official wage foundation.' },
  { country:'European Union',countryCode:'EU',source:'Eurostat earnings and labour cost data',sourceType:'official_wage',rank:2,currency:'EUR',url:'https://ec.europa.eu/eurostat/',note:'Official EU wage and labour-cost foundation.' },
  { country:'Vietnam',countryCode:'VN',source:'Vietnam Decree 293/2025/ND-CP, Region I minimum hourly wage',sourceType:'official_wage',rank:1,currency:'VND',url:'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939',updatedAt:'2026-01-01',value:25500,unit:'VND/hour',note:'Legal floor only for covered employment, not a market cleaning rate.' },
  { country:'Vietnam',countryCode:'VN',source:'Vietnam Decree 293/2025/ND-CP, Region II minimum hourly wage',sourceType:'official_wage',rank:1,currency:'VND',url:'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939',updatedAt:'2026-01-01',value:22700,unit:'VND/hour',note:'Legal floor only for covered employment.' },
  { country:'Vietnam',countryCode:'VN',source:'Vietnam Decree 293/2025/ND-CP, Region III minimum hourly wage',sourceType:'official_wage',rank:1,currency:'VND',url:'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939',updatedAt:'2026-01-01',value:20000,unit:'VND/hour',note:'Legal floor only for covered employment.' },
  { country:'Vietnam',countryCode:'VN',source:'Vietnam Decree 293/2025/ND-CP, Region IV minimum hourly wage',sourceType:'official_wage',rank:1,currency:'VND',url:'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=183939',updatedAt:'2026-01-01',value:17800,unit:'VND/hour',note:'Legal floor only for covered employment.' },
  { country:'Global',countryCode:'GLOBAL',source:'International Labour Organization, ILOSTAT wage and labour data',sourceType:'fallback',rank:10,currency:'USD',url:'https://ilostat.ilo.org/',note:'Free official global fallback when a stronger country-specific source is not configured.' }
];

export function resolveMarketCountry(input: string): MarketCountry {
  const raw = String(input || '').trim();
  const normalized = raw.toLowerCase();
  if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
  const byCode = Object.values(COUNTRY_ALIASES).find((country) => country.code.toLowerCase() === normalized);
  if (byCode) return byCode;
  return { code: raw || 'GLOBAL', label: raw || 'Global', currency: 'USD' };
}

export function marketSourcesForCountry(countryInput: string) {
  const country = resolveMarketCountry(countryInput);
  const exact = MARKET_SOURCES.filter((source) => source.countryCode === country.code).sort((a,b)=>a.rank-b.rank);
  if (exact.length) return exact;
  if (EUROSTAT_COUNTRIES.has(country.code)) {
    return MARKET_SOURCES.filter((source) => source.countryCode === 'EU').map((source) => ({...source,country:country.label,countryCode:country.code,currency:country.currency}));
  }
  return MARKET_SOURCES.filter((source) => source.countryCode === 'GLOBAL').map((source) => ({...source,country:country.label,countryCode:country.code,currency:country.currency,note:`No stronger country-specific official source is configured yet for ${country.label}. Showing ILOSTAT as the free official fallback.`}));
}
