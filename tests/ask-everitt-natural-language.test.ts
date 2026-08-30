import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNaturalAskEverittQuery } from '@/lib/ask-everitt/natural-query';
import { parseAskFilter } from '@/lib/ask-everitt/structured-query-v2';

describe('Ask Everitt natural language parser', () => {
  it('understands common schedule questions', () => {
    const next = parseAskFilter("When's my next job?");
    assert.equal(next?.entity, 'job');
    assert.equal(next?.limit, 1);
    assert.equal(next?.sortBy, 'start_time');

    const friday = parseAskFilter("What's on the schedule Friday?");
    assert.equal(friday?.entity, 'schedule');
    assert.equal(friday?.timeRange?.dayOfWeek, 5);

    const afterThree = parseAskFilter('Any jobs after 3pm today?');
    assert.equal(afterThree?.entity, 'job');
    assert.equal(afterThree?.timeRange?.relative, 'today');
    assert.equal(afterThree?.timeRange?.startTime, '15:00');
  });

  it('understands customer and worker scoping', () => {
    const customer = parseAskFilter('Jobs for the Nguyen family');
    assert.equal(customer?.entity, 'job');
    assert.equal(customer?.customerName, 'nguyen');

    const assigned = parseAskFilter('Jobs assigned to Mike this week');
    assert.equal(assigned?.entity, 'job');
    assert.equal(assigned?.workerName, 'mike');
    assert.equal(assigned?.timeRange?.relative, 'this_week');

    const free = parseAskFilter('Who is free Thursday afternoon?');
    assert.equal(free?.entity, 'worker');
    assert.equal(free?.intent, 'free_workers');
    assert.equal(free?.timeRange?.dayOfWeek, 4);
    assert.equal(free?.timeRange?.startTime, '12:00');
    assert.equal(free?.timeRange?.endTime, '17:00');
  });

  it('understands invoice and estimate filters', () => {
    const invoice = parseAskFilter('Unpaid invoices over $500');
    assert.equal(invoice?.entity, 'invoice');
    assert.equal(invoice?.isPaid, false);
    assert.equal(invoice?.minAmount, 500);

    const estimates = parseAskFilter('Big open estimates');
    assert.equal(estimates?.entity, 'estimate');
    assert.ok(estimates?.status?.includes('open'));
    assert.equal(estimates?.minAmount, 1000);
  });

  it('understands inactive and aggregate questions', () => {
    const inactive = parseAskFilter("Customers who haven't booked in 90 days");
    assert.equal(inactive?.entity, 'customer');
    assert.equal(inactive?.inactiveDays, 90);

    const count = parseAskFilter('How many jobs this week?');
    assert.equal(count?.entity, 'job');
    assert.equal(count?.aggregation, 'count');
    assert.equal(count?.timeRange?.relative, 'this_week');
  });

  it('keeps estimates requests and availability on structured search', () => {
    const estimates = parseNaturalAskEverittQuery('Show open estimates this month');
    assert.equal(estimates.intent, 'open_estimates');
    assert.equal(estimates.preferSearch, true);

    const waiting = parseNaturalAskEverittQuery('Which requests are waiting for an estimate?');
    assert.equal(waiting.intent, 'requests_waiting_estimate');
    assert.equal(waiting.preferSearch, true);

    const availability = parseNaturalAskEverittQuery('Who is free tomorrow?');
    assert.equal(availability.intent, 'worker_availability');
    assert.equal(availability.preferSearch, true);
  });

  it('canonicalizes Spanish record questions without AI', () => {
    const spanish = parseAskFilter('¿Qué trabajos tengo mañana?');
    assert.equal(spanish?.entity, 'job');
    assert.equal(spanish?.timeRange?.relative, 'tomorrow');

    const invoices = parseAskFilter('Facturas sin pagar');
    assert.equal(invoices?.entity, 'invoice');
    assert.equal(invoices?.isPaid, false);

    const quotes = parseNaturalAskEverittQuery('Cotizaciones abiertas este mes');
    assert.equal(quotes.intent, 'open_estimates');
    assert.equal(quotes.preferSearch, true);

    const free = parseNaturalAskEverittQuery('¿Quién está libre mañana?');
    assert.equal(free.intent, 'worker_availability');
    assert.equal(free.preferSearch, true);
  });

  it('canonicalizes Vietnamese record questions without AI', () => {
    const vietnamese = parseAskFilter('Công việc ngày mai');
    assert.equal(vietnamese?.entity, 'job');
    assert.equal(vietnamese?.timeRange?.relative, 'tomorrow');

    const free = parseAskFilter('Nhân viên nào rảnh thứ năm?');
    assert.equal(free?.entity, 'worker');
    assert.equal(free?.timeRange?.dayOfWeek, 4);

    const quotes = parseNaturalAskEverittQuery('Báo giá đang mở tháng này');
    assert.equal(quotes.intent, 'open_estimates');
    assert.equal(quotes.preferSearch, true);

    const requests = parseNaturalAskEverittQuery('Yêu cầu nào đang chờ báo giá?');
    assert.equal(requests.hasRecordIntent, true);
    assert.equal(requests.preferSearch, true);
  });

  it('keeps business record questions on records-first search', () => {
    const english = parseNaturalAskEverittQuery('Can you show me unpaid invoices please?');
    assert.equal(english.hasRecordIntent, true);
    assert.equal(english.preferSearch, true);

    const spanish = parseNaturalAskEverittQuery('Muéstrame los trabajos de mañana');
    assert.equal(spanish.hasRecordIntent, true);
    assert.equal(spanish.preferSearch, true);

    const vietnamese = parseNaturalAskEverittQuery('Cho tôi xem công việc ngày mai');
    assert.equal(vietnamese.hasRecordIntent, true);
    assert.equal(vietnamese.preferSearch, true);
  });
});
