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

export const MARKET_COUNTRY_OPTIONS: MarketCountry[] = Array.from(new Map(Object.values(COUNTRY_ALIASES).map((country) => [country.code, country])).values()).sort((a,b)=>a.label.localeCompare(b.label));

export const QUOTE_PROFESSIONS = ['Residential cleaning','Deep cleaning','Move-out cleaning','Move-in cleaning','Airbnb / vacation rental cleaning','Office cleaning','Lawn mowing','Landscaping','Handyman','Painting','Plumbing','Electrical','HVAC','Junk removal','Pressure washing'];

const official = (country:string,countryCode:string,currency:string,source:string,url:string,note?:string): MarketSource => ({country,countryCode,currency,source,url,sourceType:'official_wage',rank:1,note:note || `Official public wage or labour-market reference for ${country}. Use occupation and regional detail when available. It is not a local customer price range.`});

export const MARKET_SOURCES: MarketSource[] = [
  official('United States','US','USD','U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics','https://www.bls.gov/oes/','Official U.S. occupation wage foundation. Use the selected profession and metro detail when available. This is not a customer price range.'),
  {country:'United States',countryCode:'US',source:'U.S. Bureau of Labor Statistics / FRED, Producer Price Index',sourceType:'price_index',rank:2,currency:'USD',url:'https://fred.stlouisfed.org/series/PCU56172056172052',note:'Official cleaning-industry cost trend reference. Context only, not a local quote or customer price range.'},
  official('United Kingdom','GB','GBP','Office for National Statistics, earnings and hours data','https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours'),
  official('Canada','CA','CAD','Statistics Canada, labour and wage data','https://www.statcan.gc.ca/'),
  official('Australia','AU','AUD','Australian Bureau of Statistics, earnings and labour data','https://www.abs.gov.au/'),
  official('Vietnam','VN','VND','Vietnam official regional minimum wage framework','https://vbpl.moj.gov.vn/','Official legal wage-floor reference by region. It is not a cleaning rate or customer price range.'),
  official('Germany','DE','EUR','Statistisches Bundesamt (Destatis), earnings and labour costs','https://www.destatis.de/EN/Themes/Labour/Earnings/_node.html'),
  official('France','FR','EUR','INSEE, wages and labour cost statistics','https://www.insee.fr/en/statistiques'),
  official('Spain','ES','EUR','Instituto Nacional de Estadística (INE), labour costs and wages','https://www.ine.es/'),
  official('Italy','IT','EUR','Istat, labour and earnings statistics','https://www.istat.it/en/'),
  official('Netherlands','NL','EUR','Statistics Netherlands (CBS), wages and labour','https://www.cbs.nl/en-gb'),
  official('Belgium','BE','EUR','Statbel, wages and labour market statistics','https://statbel.fgov.be/en'),
  official('Austria','AT','EUR','Statistics Austria, earnings and labour costs','https://www.statistik.at/en/'),
  official('Ireland','IE','EUR','Central Statistics Office Ireland, earnings and labour costs','https://www.cso.ie/en/'),
  official('Portugal','PT','EUR','Statistics Portugal (INE), labour and earnings statistics','https://www.ine.pt/'),
  official('Finland','FI','EUR','Statistics Finland, wages salaries and labour costs','https://stat.fi/en/'),
  official('Greece','GR','EUR','Hellenic Statistical Authority (ELSTAT), labour and earnings','https://www.statistics.gr/en/home/'),
  official('Sweden','SE','SEK','Statistics Sweden (SCB), wages and salaries','https://www.scb.se/en/finding-statistics/statistics-by-subject-area/labour-market/wages-salaries-and-labour-costs/'),
  official('Norway','NO','NOK','Statistics Norway (SSB), earnings statistics','https://www.ssb.no/en/arbeid-og-lonn/lonn-og-arbeidskraftkostnader/statistikk/lonn'),
  official('Denmark','DK','DKK','Statistics Denmark, earnings statistics','https://www.dst.dk/en/Statistik/emner/arbejde-og-indkomst/indkomst-og-loen'),
  official('Switzerland','CH','CHF','Swiss Federal Statistical Office, wages and income from employment','https://www.bfs.admin.ch/bfs/en/home/statistics/work-income/wages-income-employment-labour-costs.html'),
  official('Poland','PL','PLN','Statistics Poland, wages and salaries','https://stat.gov.pl/en/topics/labour-market/working-employed-wages-and-salaries-cost-of-labour/'),
  official('Czechia','CZ','CZK','Czech Statistical Office, labour and earnings','https://csu.gov.cz/'),
  official('Hungary','HU','HUF','Hungarian Central Statistical Office, earnings','https://www.ksh.hu/?lang=en'),
  official('Romania','RO','RON','National Institute of Statistics Romania, earnings and labour','https://insse.ro/cms/en'),
  official('Japan','JP','JPY','Ministry of Health, Labour and Welfare, wage statistics','https://www.mhlw.go.jp/english/database/db-l/'),
  official('China','CN','CNY','National Bureau of Statistics of China, employment and wages','https://www.stats.gov.cn/english/'),
  official('South Korea','KR','KRW','Korean Statistical Information Service (KOSIS), wages and labour','https://kosis.kr/eng/'),
  official('India','IN','INR','Labour Bureau, Ministry of Labour and Employment, Indian Labour Statistics','https://labourbureau.gov.in/indian-labour-statistics'),
  official('Singapore','SG','SGD','Ministry of Manpower, Occupational Wages','https://stats.mom.gov.sg/Pages/Occupational-Wages-Tables2025.aspx','Official Singapore occupational wage tables covering hundreds of occupations. This is a wage benchmark, not a customer price range.'),
  official('Malaysia','MY','MYR','Department of Statistics Malaysia, salaries and wages statistics','https://www.dosm.gov.my/portal-main/release-content/employee-wages-statistics-formal-sector-q12026'),
  official('Thailand','TH','THB','National Statistical Office of Thailand, labour statistics','https://www.nso.go.th/nsoweb/index?set_lang=en'),
  official('Indonesia','ID','IDR','Statistics Indonesia (BPS), labour and wage statistics','https://www.bps.go.id/en'),
  official('Philippines','PH','PHP','Philippine Statistics Authority, labour and wage statistics','https://psa.gov.ph/statistics/labor'),
  official('Taiwan','TW','TWD','Taiwan Ministry of Labor, labour statistics','https://english.mol.gov.tw/'),
  official('Mexico','MX','MXN','INEGI, labour and earnings statistics','https://www.inegi.org.mx/'),
  official('Brazil','BR','BRL','IBGE, labour and earnings statistics','https://www.ibge.gov.br/en/statistics/social/labor.html'),
  official('Argentina','AR','ARS','INDEC, labour market and income statistics','https://www.indec.gob.ar/'),
  official('Chile','CL','CLP','Instituto Nacional de Estadísticas Chile, remunerations and labour','https://www.ine.gob.cl/'),
  official('Colombia','CO','COP','DANE, labour market and income statistics','https://www.dane.gov.co/'),
  official('Peru','PE','PEN','INEI, employment and labour income statistics','https://www.inei.gob.pe/'),
  official('New Zealand','NZ','NZD','Stats NZ, earnings and employment statistics','https://www.stats.govt.nz/topics/income'),
  official('South Africa','ZA','ZAR','Statistics South Africa, employment and earnings','https://www.statssa.gov.za/'),
  official('United Arab Emirates','AE','AED','Federal Competitiveness and Statistics Centre, labour statistics','https://fcsc.gov.ae/en-us/Pages/Statistics/Statistics-by-Subject.aspx'),
  official('Saudi Arabia','SA','SAR','General Authority for Statistics, labour market statistics','https://www.stats.gov.sa/en'),
  official('Israel','IL','ILS','Central Bureau of Statistics Israel, wages and employment','https://www.cbs.gov.il/en/subjects/Pages/Labour-and-Wages.aspx'),
  official('Türkiye','TR','TRY','Turkish Statistical Institute (TurkStat), labour and earnings','https://data.tuik.gov.tr/'),
  {country:'Global',countryCode:'GLOBAL',source:'International Labour Organization, ILOSTAT wage and labour data',sourceType:'fallback',rank:10,currency:'USD',url:'https://ilostat.ilo.org/',note:'Official international fallback only when a country outside the configured checklist is entered.'}
];

export function resolveMarketCountry(input: string): MarketCountry {
  const raw=String(input||'').trim(); const normalized=raw.toLowerCase();
  if(COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
  const byCode=Object.values(COUNTRY_ALIASES).find((country)=>country.code.toLowerCase()===normalized);
  if(byCode) return byCode;
  return {code:raw||'GLOBAL',label:raw||'Global',currency:'USD'};
}

export function marketSourcesForCountry(countryInput:string) {
  const country=resolveMarketCountry(countryInput);
  const exact=MARKET_SOURCES.filter((source)=>source.countryCode===country.code).sort((a,b)=>a.rank-b.rank);
  if(exact.length) return exact;
  return MARKET_SOURCES.filter((source)=>source.countryCode==='GLOBAL').map((source)=>({...source,country:country.label,countryCode:country.code,currency:country.currency,note:`No country-specific source is configured for ${country.label}. ILOSTAT is shown as an official international fallback, not as a local customer price range.`}));
}
