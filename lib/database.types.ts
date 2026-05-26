export type Worker = {
  id: string;
  name: string;
  role: string | null;
  created_at?: string | null;
};

export type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  assigned_to: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  completion_notes: string | null;
  created_at: string | null;
  completed_at: string | null;
  workers?: Worker | null;
};
