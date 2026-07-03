/** Shared empty-state copy for authenticated app pages (no demo or placeholder records). */
export const EMPTY_COPY = {
  workers: {
    title: 'No people yet',
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
