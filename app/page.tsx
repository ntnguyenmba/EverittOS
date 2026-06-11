import { redirect } from 'next/navigation';

/** App root sends visitors to sign in. Marketing lives on everittventures.com/tech. */
export default function HomePage() {
  redirect('/login');
}
