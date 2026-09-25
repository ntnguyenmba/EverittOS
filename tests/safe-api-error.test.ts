import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicErrorMessage } from '../lib/safe-api-error';

describe('publicErrorMessage', () => {
  it('hides PostgREST and Postgres internals', () => {
    const quiet = console.error;
    console.error = () => undefined;
    try {
      assert.equal(publicErrorMessage({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: '' }), 'Something went wrong. Try again.');
      assert.equal(publicErrorMessage({ message: 'duplicate key value violates unique constraint "jobs_pkey"', code: '23505' }, 'Could not save.'), 'Could not save.');
      assert.equal(publicErrorMessage({ message: 'relation "public.jobs" does not exist' }), 'Something went wrong. Try again.');
    } finally {
      console.error = quiet;
    }
  });

  it('keeps application and auth messages', () => {
    assert.equal(publicErrorMessage(new Error('This job is locked.')), 'This job is locked.');
    assert.equal(publicErrorMessage({ message: 'Password should be at least 6 characters.', status: 422 }), 'Password should be at least 6 characters.');
    assert.equal(publicErrorMessage(null, 'Fallback'), 'Fallback');
  });
});
