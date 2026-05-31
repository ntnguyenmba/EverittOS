'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isOwnerOrAdmin, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Worker = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
};

export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadWorkers() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));
    setCanManage(isOwnerOrAdmin(normalizeRole(profile?.role)));

    const { data } = await supabase.from('workers').select('id, name, role, phone').order('created_at', { ascending: false });
    setWorkers(data || []);
    setLoading(false);
  }

  async function addWorker() {
    if (!name.trim()) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('workers').insert({
      user_id: user.id,
      name: name.trim(),
      role: role.trim() || null,
      phone: phone.trim() || null
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName('');
    setRole('');
    setPhone('');
    loadWorkers();
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Workers</h2>
        <p>Crew members linked to your operation.</p>

        {canManage && (
          <div className="card form" style={{ marginTop: 20 }}>
            <h3>Add worker</h3>
            <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
            <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn btn-primary" type="button" onClick={addWorker}>
              Save worker
            </button>
          </div>
        )}

        <div className="grid-3" style={{ marginTop: 20 }}>
          {loading && <p>Loading workers...</p>}
          {!loading && workers.length === 0 && <p>No workers yet.</p>}
          {!loading &&
            workers.map((worker) => (
              <div className="card" key={worker.id}>
                <h3>{worker.name}</h3>
                <p>{worker.role || 'Crew member'}</p>
                <p>{worker.phone || 'No phone'}</p>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
