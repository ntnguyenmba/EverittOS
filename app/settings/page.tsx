'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('Everitt Property Group');
  const [region, setRegion] = useState('Dallas, TX');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function changePassword() {
    setMessage('');

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Password updated successfully.');
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <main className="main">
        <h2>Admin Settings</h2>

        <div className="card form">
          <input
            className="input"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />

          <input
            className="input"
            placeholder="Default region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />

          <button className="btn btn-primary">
            Save settings
          </button>

          <hr />

          <h3>Change password</h3>

          <input
            className="input"
            placeholder="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="btn btn-primary"
            onClick={changePassword}
          >
            Update password
          </button>

          {message && <p>{message}</p>}
        </div>
      </main>
    </div>
  );
}