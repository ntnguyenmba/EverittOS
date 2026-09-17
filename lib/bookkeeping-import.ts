export type BookkeepingEntryType = 'income' | 'worker_payment' | 'expense';
export type BookkeepingImportDecision = 'skip' | 'create';

export type BookkeepingImportRow = {
  rowNumber: number;
  entryType: BookkeepingEntryType | '';
  entryDate: string;
  amount: number | null;
  title: string;
  counterparty: string;
  category: string;
  paymentMethod: string;
  notes: string;
  errors: string[];
  duplicateKind: 'csv' | 'everittos' | null;
  duplicateReason: string | null;
};

type ExistingEntry = { entry_type:string|null; entry_date:string|null; amount:number|string|null; title:string|null; counterparty:string|null };
const HEADER_ALIASES: Record<string,string[]> = { entry_type:['entry_type','type','transaction_type'], entry_date:['entry_date','date','transaction_date'], amount:['amount','total'], title:['title','name','source','description'], counterparty:['counterparty','customer','worker','vendor','payee'], category:['category'], payment_method:['payment_method','payment method','method'], notes:['notes','note','memo'] };
function normalize(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,' ')}
function parseCsvLine(line:string){const cells:string[]=[];let current='';let quoted=false;for(let i=0;i<line.length;i+=1){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){current+='"';i+=1}else quoted=!quoted}else if(char===','&&!quoted){cells.push(current.trim());current=''}else current+=char}cells.push(current.trim());return cells}
function indexFor(headers:string[],key:keyof typeof HEADER_ALIASES){const aliases=HEADER_ALIASES[key].map(normalize);return headers.findIndex(header=>aliases.includes(normalize(header)))}
function valueAt(cells:string[],index:number){return index>=0?String(cells[index]??'').trim():''}
function normalizeType(value:string):BookkeepingEntryType|''{const normalized=normalize(value).replace(/[ -]+/g,'_');if(['income','revenue','payment_received'].includes(normalized))return'income';if(['worker_payment','contractor_payment','contractor_pay','worker_pay','payroll'].includes(normalized))return'worker_payment';if(['expense','expenses','cost'].includes(normalized))return'expense';return''}
function normalizeDate(value:string){const trimmed=value.trim();if(!trimmed)return'';const iso=trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);if(iso)return`${iso[1]}-${iso[2]}-${iso[3]}`;const us=trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(us){const year=us[3].length===2?`20${us[3]}`:us[3];return`${year}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`}return''}
function normalizeAmount(value:string){const cleaned=value.replace(/[$,\s]/g,'').replace(/^\((.*)\)$/,'-$1');const number=Number(cleaned);return Number.isFinite(number)?Math.abs(number):null}
function fingerprint(row:Pick<BookkeepingImportRow,'entryType'|'entryDate'|'amount'|'title'|'counterparty'>){return[row.entryType,row.entryDate,Number(row.amount||0).toFixed(2),normalize(row.counterparty||row.title)].join('|')}

export function parseBookkeepingImportCsv(csv:string){
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim().length>0);
  if(lines.length<2)return{rows:[] as BookkeepingImportRow[],fatalError:'missing_rows'};
  const headers=parseCsvLine(lines[0]);
  const indexes={entryType:indexFor(headers,'entry_type'),entryDate:indexFor(headers,'entry_date'),amount:indexFor(headers,'amount'),title:indexFor(headers,'title'),counterparty:indexFor(headers,'counterparty'),category:indexFor(headers,'category'),paymentMethod:indexFor(headers,'payment_method'),notes:indexFor(headers,'notes')};
  if(indexes.entryType<0||indexes.entryDate<0||indexes.amount<0)return{rows:[] as BookkeepingImportRow[],fatalError:'missing_required_columns'};
  const rows=lines.slice(1).map((line,index):BookkeepingImportRow=>{const cells=parseCsvLine(line);const entryType=normalizeType(valueAt(cells,indexes.entryType));const entryDate=normalizeDate(valueAt(cells,indexes.entryDate));const amount=normalizeAmount(valueAt(cells,indexes.amount));const errors:string[]=[];if(!entryType)errors.push('invalid_type');if(!entryDate)errors.push('invalid_date');if(amount===null||amount<=0)errors.push('invalid_amount');return{rowNumber:index+2,entryType,entryDate,amount,title:valueAt(cells,indexes.title),counterparty:valueAt(cells,indexes.counterparty),category:valueAt(cells,indexes.category),paymentMethod:valueAt(cells,indexes.paymentMethod),notes:valueAt(cells,indexes.notes),errors,duplicateKind:null,duplicateReason:null}});
  return{rows,fatalError:null as string|null};
}

export function detectBookkeepingImportDuplicates(rows:BookkeepingImportRow[],existing:ExistingEntry[]){const existingKeys=new Set(existing.map(entry=>fingerprint({entryType:normalizeType(String(entry.entry_type||'')),entryDate:normalizeDate(String(entry.entry_date||'')),amount:normalizeAmount(String(entry.amount??'')),title:String(entry.title||''),counterparty:String(entry.counterparty||'')})));const seen=new Set<string>();return rows.map(row=>{if(row.errors.length)return row;const key=fingerprint(row);if(existingKeys.has(key))return{...row,duplicateKind:'everittos' as const,duplicateReason:'matches_existing'};if(seen.has(key))return{...row,duplicateKind:'csv' as const,duplicateReason:'matches_csv'};seen.add(key);return row})}
export function buildBookkeepingImportTemplateCsv(){return['type,date,amount,name,counterparty,category,payment_method,notes','expense,2026-09-16,45.25,Supplies,Home Depot,Materials,Card,Example row'].join('\n')}
