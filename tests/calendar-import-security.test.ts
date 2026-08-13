import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  convertWebcalToHttps,
  isBlockedHostname,
  isBlockedIpAddress,
  redactFeedUrl,
  validatePublicFeedUrl
} from '@/lib/calendar-import/feed-security';

describe('calendar feed URL security', () => {
  it('converts webcal:// to https://', () => {
    assert.equal(
      convertWebcalToHttps('webcal://calendar.example.com/feed.ics'),
      'https://calendar.example.com/feed.ics'
    );
    assert.equal(
      convertWebcalToHttps('WEBCAL://calendar.example.com/private/feed'),
      'https://calendar.example.com/private/feed'
    );
  });

  it('accepts public https calendar hosts', () => {
    const result = validatePublicFeedUrl('https://calendar.example.com/feed.ics');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.href, 'https://calendar.example.com/feed.ics');
      assert.equal(result.hostname, 'calendar.example.com');
    }
  });

  it('converts and accepts webcal public hosts', () => {
    const result = validatePublicFeedUrl('webcal://calendar.example.com/feed.ics');
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.href, /^https:\/\/calendar\.example\.com\/feed\.ics$/);
  });

  it('rejects unsafe URLs', () => {
    const rejected = [
      'http://calendar.example.com/feed.ics',
      'file:///etc/passwd',
      'ftp://calendar.example.com/feed.ics',
      'https://localhost/feed.ics',
      'https://127.0.0.1/feed.ics',
      'https://[::1]/feed.ics',
      'https://10.0.0.8/feed.ics',
      'https://192.168.1.20/feed.ics',
      'https://172.16.0.4/feed.ics',
      'https://169.254.1.1/feed.ics',
      'https://calendar.example.com:8443/feed.ics',
      'https://user:pass@calendar.example.com/feed.ics'
    ];

    for (const url of rejected) {
      const result = validatePublicFeedUrl(url);
      assert.equal(result.ok, false, url);
    }
  });

  it('treats loopback and private IPs as blocked', () => {
    assert.equal(isBlockedIpAddress('127.0.0.1'), true);
    assert.equal(isBlockedIpAddress('10.1.2.3'), true);
    assert.equal(isBlockedIpAddress('192.168.0.10'), true);
    assert.equal(isBlockedIpAddress('172.16.5.4'), true);
    assert.equal(isBlockedIpAddress('169.254.12.3'), true);
    assert.equal(isBlockedIpAddress('::1'), true);
    assert.equal(isBlockedIpAddress('8.8.8.8'), false);
    assert.equal(isBlockedHostname('localhost'), true);
    assert.equal(isBlockedHostname('calendar.example.com'), false);
  });

  it('never returns the raw URL from the redaction helper', () => {
    const secret = 'https://calendar.example.com/private/abc.ics?access=secret-value';
    assert.equal(redactFeedUrl(secret), '[redacted-calendar-url]');
    assert.doesNotMatch(redactFeedUrl(secret), /access=/);
    assert.doesNotMatch(redactFeedUrl(secret), /example\.com/);
  });
});
