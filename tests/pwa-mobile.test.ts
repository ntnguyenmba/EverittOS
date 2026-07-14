import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('PWA manifest includes required install fields', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; sizes: string }>;
  };

  assert.equal(manifest.name, 'EverittOS');
  assert.equal(manifest.short_name, 'EverittOS');
  assert.equal(manifest.start_url, '/dashboard');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => icon.src.includes('maskable')));
});

test('service worker avoids caching private API routes', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /\/api\//);
  assert.match(sw, /NEVER_CACHE/);
  assert.doesNotMatch(sw, /cache\.put\(request, response\.clone\(\)\)[\s\S]*\/api\//);
});

test('apple-app-site-association uses placeholder team ID', () => {
  const aasa = readFileSync('public/.well-known/apple-app-site-association', 'utf8');
  assert.match(aasa, /TEAMID\.com\.everittventures\.everittos/);
  assert.doesNotMatch(aasa, /\.json/);
});

test('assetlinks.json uses release fingerprint placeholder', () => {
  const assetLinks = JSON.parse(readFileSync('public/.well-known/assetlinks.json', 'utf8')) as Array<{
    target: { package_name: string; sha256_cert_fingerprints: string[] };
  }>;
  assert.equal(assetLinks[0].target.package_name, 'com.everittventures.everittos');
  assert.equal(assetLinks[0].target.sha256_cert_fingerprints[0], 'REPLACE_WITH_RELEASE_KEY_SHA256');
});
