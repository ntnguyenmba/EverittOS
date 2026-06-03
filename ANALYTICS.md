# Google Analytics

Load GA only on public marketing routes. Do not track authenticated product usage here.

**Allowed:** `/`, `/pricing`, `/product` (features), `/signup`

**Excluded:** `/dashboard`, `/jobs`, `/workers`, `/settings`, `/login`, and all other app routes

In `app/layout.tsx`, render `<AnalyticsGate />` inside `<body>` (not on every page via a global unconditional script).

```tsx
import { AnalyticsGate } from '@/components/analytics-gate';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsGate />
        {children}
      </body>
    </html>
  );
}
```

Product analytics (dashboard, jobs, reports) can use a separate tool later.
