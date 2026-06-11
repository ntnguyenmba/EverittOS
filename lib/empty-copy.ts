/** Shared empty-state copy for authenticated app pages (no demo or placeholder records). */
export const EMPTY_COPY = {
  workers: {
    title: 'No workers yet',
    description: 'Add your first team member.'
  },
  customers: {
    title: 'No customers yet',
    description: 'Create your first customer.'
  },
  jobs: {
    title: 'No jobs yet',
    description: 'Create your first job.'
  },
  schedule: {
    title: 'No scheduled work yet',
    description: 'Create a job and add dates to see it on your calendar.'
  },
  activity: {
    title: 'No activity yet',
    description: 'Updates to jobs, team, and reports will show up here.'
  },
  notifications: {
    title: 'No notifications yet',
    description: 'Assignments, invites, and billing updates will appear here.'
  },
  workflows: {
    title: 'No workflows yet',
    description: 'Create a checklist workflow when you are ready to standardize jobs.'
  },
  photos: {
    title: 'No photos yet',
    description: 'Upload before and after photos to document completed work.'
  }
} as const;
