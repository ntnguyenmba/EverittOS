import { redirect } from 'next/navigation';

/** Legacy demo route — production workspaces start clean; send users to the dashboard. */
export default function DemoPage() {
  redirect('/dashboard');
}
