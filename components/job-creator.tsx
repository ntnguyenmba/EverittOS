'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';

type JobCreatorProps = {
  onJobCreated?: () => void;
};

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  async function createJob() {
    if (!title.trim()) {
      alert('Add a job title first.');
      return;
    }

    setLoading(true);
    setCreated(false);

    const { error } = await supabase.from('jobs').insert([
      {
        title: title.trim(),
        customer_name: customerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        status: 'new'
      }
    ]);

    setLoading(false);

    if (error) {
      alert(error.message);
      console.error('Supabase create job error:', error);
      return;
    }

    setCreated(true);
    setTitle('');
    setAddress('');
    setCustomerName('');
    setPhone('');
    setNotes('');
    onJobCreated?.();
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
          placeholder="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />

        <input
          className="input"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          className="input"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
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
          {loading ? 'Creating...' : 'Create job'}
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