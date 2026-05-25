export type Job = {
  id: string;
  title: string;
  property: string;
  worker: string;
  status: 'Pending' | 'Assigned' | 'Progress' | 'Completed' | 'Verified';
  priority: 'Low' | 'Medium' | 'High';
  due: string;
  location: string;
  notes: string;
  beforePhoto?: string;
  afterPhoto?: string;
  timestamp: string;
};

export const jobs: Job[] = [
  {
    id: 'job-1001',
    title: 'Unit 214 HVAC inspection',
    property: 'Lakeview Residences',
    worker: 'Marco Silva',
    status: 'Progress',
    priority: 'High',
    due: 'Today, 3:00 PM',
    location: 'Dallas, TX',
    notes: 'Tenant reported weak airflow and warm air from vent.',
    timestamp: 'Created 9:18 AM'
  },
  {
    id: 'job-1002',
    title: 'Pool gate repair proof',
    property: 'Northline Villas',
    worker: 'Ana Lopez',
    status: 'Completed',
    priority: 'Medium',
    due: 'Today, 5:30 PM',
    location: 'Plano, TX',
    notes: 'Upload before and after photos before manager review.',
    timestamp: 'Created 10:02 AM'
  },
  {
    id: 'job-1003',
    title: 'Move-out cleaning verification',
    property: 'The Mason',
    worker: 'David Chen',
    status: 'Verified',
    priority: 'Low',
    due: 'Tomorrow, 11:00 AM',
    location: 'Frisco, TX',
    notes: 'Client proof report sent with timestamp and completion notes.',
    timestamp: 'Created yesterday'
  }
];

export function getJob(id: string) {
  return jobs.find(job => job.id === id) || jobs[0];
}
