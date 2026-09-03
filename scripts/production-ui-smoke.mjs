const baseUrl = (process.env.UI_SMOKE_BASE_URL || 'https://app.everittventures.com').replace(/\/$/, '');

const routes = [
  '/',
  '/login',
  '/dashboard',
  '/jobs',
  '/portal/client',
  '/portal/client/jobs',
  '/portal/contractor',
  '/portal/contractor/jobs',
];

const failures = [];

await Promise.all(routes.map(async (route) => {
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'follow',
      headers: { 'user-agent': 'EverittOS-UI-Smoke/1.0' },
    });
    const html = await response.text();

    if (!response.ok) failures.push(`${route}: HTTP ${response.status}`);
    if (!html.includes('width=device-width')) failures.push(`${route}: missing responsive viewport`);
    if (!html.includes('/_next/static/css/')) failures.push(`${route}: missing compiled styles`);
  } catch (error) {
    failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
  }
}));

if (failures.length) {
  console.error('Production UI smoke failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production UI smoke passed for ${routes.length} owner, client, worker, and public routes at ${baseUrl}.`);
