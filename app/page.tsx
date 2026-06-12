import { redirect } from 'next/navigation';

/** App entry redirects to sign in. Product marketing lives on everittventures.com/tech. */
export default function HomePage() {
  redirect('/login');
}
