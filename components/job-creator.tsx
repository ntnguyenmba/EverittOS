'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';

export function JobCreator() {
  const [title, setTitle] = useState('');
  const [property, setProperty] = useState('');
  const [worker, setWorker] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  async function createJob() {
    setLoading(true);

    const { error } = await supabase.from('jobs').insert([
      {
        title,
        property,
        worker,
        notes,
        status: 'Assigned',
        priority: 'Medium'
      }
    ]);

    setLoading(false);

    if (!error) {
      setCreated(true);
      setTitle('');
      setProperty('');
      setWorker('');
      setNotes('');
    } else {
      alert('Error creating job');
      console.log(error);
    }
  }

  return (
    <div className="card">
      <h3>Create a job</h3>

      <div className="form">
        <input
          className="input"
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="input"
          placeholder="Property"
          value={property}
          onChange={(e) => setProperty(e.target.value)}
        />

        <input
          className="input"
          placeholder="Worker"
          value={worker}
          onChange={(e) => setWorker(e.target.value)}
        />

        <textarea
          className="input"
          placeholder="Notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Button
          className="btn-primary"
          onClick={createJob}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create and assign job'}
        </Button>
      </div>

      {created && (
        <p style={{ color: 'var(--green)' }}>
          Job saved successfully.
        </p>
      )}
    </div>
  );
}