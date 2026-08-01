/** Shared empty-state copy and primary actions for authenticated app pages. */
export const EMPTY_COPY = {
  workers: {
    title: 'No team members',
    description: '',
    actionLabel: 'Add team member',
    actionHref: '/people'
  },
  customers: {
    title: 'No customers yet',
    description: '',
    actionLabel: 'Add customer',
    actionHref: '/customers/new'
  },
  jobs: {
    title: 'No jobs yet',
    description: '',
    actionLabel: 'Create job',
    actionHref: '/jobs/new'
  },
  schedule: {
    title: 'Nothing scheduled',
    description: '',
    actionLabel: 'Create job',
    actionHref: '/jobs/new'
  },
  activity: {
    title: 'No activity yet',
    description: '',
    actionLabel: null,
    actionHref: null
  },
  notifications: {
    title: 'You are all caught up',
    description: '',
    actionLabel: null,
    actionHref: null
  },
  workflows: {
    title: 'No workflows yet',
    description: '',
    actionLabel: 'Create workflow',
    actionHref: '/workflows/new'
  },
  photos: {
    title: 'No photos yet',
    description: '',
    actionLabel: 'Open jobs',
    actionHref: '/jobs'
  }
} as const;
