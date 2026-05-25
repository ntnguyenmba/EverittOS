import Link from 'next/link';

const links = [
  ['Dashboard', '/dashboard'],
  ['Jobs', '/jobs'],
  ['Workers', '/workers'],
  ['Mobile Worker View', '/demo'],
  ['Admin Settings', '/settings']
];

export function Sidebar() {
  return <aside className="sidebar">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</aside>;
}
