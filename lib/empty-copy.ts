/** Shared empty-state copy for authenticated app pages (no demo or placeholder records). */
export const EMPTY_COPY = {
  workers: {
    title: 'No team members yet',
    description: 'Add your first contractor or employee, then assign them to jobs from the schedule.'
  },
  customers: {
    title: 'No customers yet',
    description: 'Add your first customer to create jobs, schedule visits, and keep their history in one place.'
  },
  jobs: {
    title: 'No jobs yet',
    description: 'Create your first job with a customer, date, and time so it appears on the schedule.'
  },
  schedule: {
    title: 'Nothing scheduled',
    description: 'Create or schedule a job and its visit will appear here by date and time.'
  },
  activity: {
    title: 'No activity yet',
    description: 'Job updates, assignments, customer payments, and team changes will appear here.'
  },
  notifications: {
    title: 'You are all caught up',
    description: 'New assignments, invitations, job updates, and billing notices will appear here.'
  },
  workflows: {
    title: 'No workflows yet',
    description: 'Create a reusable checklist when you want the same steps followed on every job.'
  },
  photos: {
    title: 'No photos yet',
    description: 'Open a job and upload before and after photos to document the work.'
  }
} as const;
