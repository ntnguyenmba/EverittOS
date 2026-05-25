'use client';
import { useState } from 'react';
import { Button } from './ui/button';

export function JobCreator() {
  const [created, setCreated] = useState(false);
  return (
    <div className="card">
      <h3>Create a job</h3>
      <div className="form">
        <input className="input" placeholder="Job title" />
        <input className="input" placeholder="Property" />
        <select className="input"><option>Assign worker</option><option>Marco Silva</option><option>Ana Lopez</option><option>David Chen</option></select>
        <textarea className="input" placeholder="Notes" rows={4} />
        <Button className="btn-primary" onClick={() => setCreated(true)}>Create and assign job</Button>
      </div>
      {created && <p style={{ color: 'var(--green)' }}>Job created, worker notified, and status set to Assigned.</p>}
    </div>
  );
}
