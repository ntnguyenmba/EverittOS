/** Shared empty-state copy for authenticated app pages (no demo or placeholder records). */
export const EMPTY_COPY = {
  workers: {
    title: 'No people yet',
    description: 'Invite teammates so you can assign jobs and track labor.'
  },
  customers: {
    title: 'No customers yet',
    description: 'Add a customer to schedule work and send invoices.'
  },
  jobs: {
    title: 'No jobs yet',
    description: 'Create a job with a date and time to build your schedule.'
  },
  schedule: {
    title: 'Nothing scheduled',
    description: 'Scheduled visits will show here by day and time.'
  },
  activity: {
    title: 'No activity yet',
    description: 'Job updates, assignments, and payments will appear here.'
  },
  notifications: {
    title: 'No notifications yet',
    description: 'Assignments, invites, and billing updates will appear here.'
  },
  workflows: {
    title: 'No workflows yet',
    description: 'Create a checklist when you want the same steps on every job.'
  },
  photos: {
    title: 'No photos yet',
    description: 'Upload before and after photos to document completed work.'
  }
} as const;
