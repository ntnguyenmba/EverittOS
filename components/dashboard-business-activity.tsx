'use client';
import Link from 'next/link';
import { useLocale } from '@/components/locale-provider';
import { getCommonUiCopy } from '@/lib/i18n/common-ui-copy';
import { formatDashboardActivity,type ActivityLogRow } from '@/lib/business-activity';
type DashboardBusinessActivityProps={items:ActivityLogRow[];loading?:boolean};
export function DashboardBusinessActivity({items,loading}:DashboardBusinessActivityProps){const {locale}=useLocale();const c=getCommonUiCopy(locale);const formatted=items.map(formatDashboardActivity);return <section aria-label={c.recentActivity} style={{minHeight:0}}><h2 style={{margin:'0 0 12px',fontSize:18}}>{c.recentActivity}</h2>{loading?<p className="loading-state" role="status" style={{margin:0}}>{c.loading}</p>:null}{!loading&&formatted.length===0?<p className="muted" style={{margin:0}}>{c.noRecentActivity}</p>:null}{!loading?formatted.map(row=>{const content=<><span className="dashboard-activity-title">{row.title}</span>{row.detail?<span className="muted dashboard-activity-detail">{row.detail}</span>:null}</>;return row.href?<Link key={row.id} href={row.href} target="_blank" rel="noopener noreferrer" className="dashboard-today-row dashboard-activity-row">{content}</Link>:<div key={row.id} className="dashboard-today-row dashboard-activity-row">{content}</div>}):null}</section>;}
