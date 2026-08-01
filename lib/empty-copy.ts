/** Shared empty-state copy for authenticated app pages (no demo or placeholder records). */
export const EMPTY_COPY = {
  workers: {
    title: 'No team members',
    description: ''
  },
  customers: {
    title: 'No customers yet',
    description: ''
  },
  jobs: {
    title: 'No jobs yet',
    description: ''
  },
  schedule: {
    title: 'Nothing scheduled',
    description: ''
  },
  activity: {
    title: 'No activity yet',
    description: ''
  },
  notifications: {
    title: 'You are all caught up',
    description: ''
  },
  workflows: {
    title: 'No workflows yet',
    description: ''
  },
  photos: {
    title: 'No photos yet',
    description: ''
  }
} as const;
