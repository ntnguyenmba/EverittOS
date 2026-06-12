import type { Messages } from '@/lib/i18n/types';

export const messages: Messages = {
  common: {
    continue: 'Continue',
    skip: 'Skip',
    skipSetup: 'Skip Setup',
    skipForNow: 'Skip For Now',
    back: 'Back',
    loading: 'Loading…',
    connect: 'Connect',
    connectLater: 'Connect Later',
    addAnother: 'Add Another',
    goToDashboard: 'Go To Dashboard',
    exploreFeatures: 'Explore Features',
    createSampleJob: 'Create Sample Job',
    optional: 'Optional',
    language: 'Language'
  },
  onboarding: {
    progress: 'Step {current} of {total}',
    skipEntire: 'Skip setup',
    loading: 'Loading your workspace…',
    calendarLater: 'Calendar integration can be connected later.',
    calendarNotConfigured:
      'Calendar connection is not configured yet. You can continue and add it later from Settings.',
    calendarConnected: 'Google Calendar is connected.',
    connectGoogleCalendar: 'Connect Google Calendar',
    openIntegrations: 'Open integrations settings',
    inviteFailed: 'Invite could not be sent. You can invite team members later from Settings.',
    sampleJobName: 'Welcome visit',
    sampleCustomer: 'Sample customer',
    steps: {
      welcome: {
        title: 'Welcome to EverittOS',
        subtitle:
          'Manage jobs, customers, schedules, workers, and operations from one place.'
      },
      business: {
        title: 'Business profile',
        subtitle: 'Tell us about your company. Every field is optional.',
        companyName: 'Company name',
        industry: 'Industry',
        teamSize: 'Team size'
      },
      operations: {
        title: 'Operations setup',
        subtitle: 'What do you manage? Select all that apply.'
      },
      team: {
        title: 'Invite your team',
        subtitle: 'Add teammates now or skip and invite later. No fields are required.',
        email: 'Email address',
        role: 'Role'
      },
      calendar: {
        title: 'Connect your calendar',
        subtitle: 'Sync scheduled jobs with Google Calendar, or connect later from Settings.',
        google: 'Google Calendar'
      },
      firstJob: {
        title: 'Create your first job',
        subtitle: 'Add a real job, create a sample, or skip and start from your dashboard.',
        jobName: 'Job name',
        customer: 'Customer',
        date: 'Date'
      },
      complete: {
        title: 'Your workspace is ready',
        message:
          'You can now manage jobs, customers, schedules, workers, and operations from your dashboard.'
      }
    },
    industries: {
      property_management: 'Property Management',
      cleaning: 'Cleaning',
      salon: 'Salon',
      barber: 'Barber',
      spa: 'Spa',
      beauty_studio: 'Beauty Studio',
      maintenance: 'Maintenance',
      construction: 'Construction',
      general_contractor: 'General Contractor',
      landscaping: 'Landscaping',
      field_service: 'Field Service',
      janitorial: 'Janitorial',
      real_estate: 'Real Estate',
      home_services: 'Home Services',
      hospitality: 'Hospitality',
      other: 'Other'
    },
    teamSizes: {
      solo: 'Just Me',
      small: '2–5',
      medium: '6–20',
      large: '21–50',
      enterprise: '50+'
    },
    operations: {
      jobs: 'Jobs',
      properties: 'Properties',
      customers: 'Customers',
      contractors: 'Contractors',
      workers: 'Workers',
      maintenance: 'Maintenance',
      cleaning: 'Cleaning',
      inspections: 'Inspections',
      other: 'Other'
    },
    roles: {
      admin: 'Admin',
      manager: 'Manager',
      worker: 'Worker'
    },
    checklist: {
      title: 'Getting started',
      description:
        'Optional setup to help you launch faster. Skip anytime. Nothing here blocks your work.',
      dismiss: 'Dismiss',
      continue: 'Continue setup',
      settings: 'Workspace settings',
      steps: [
        'Welcome',
        'Business profile',
        'Operations',
        'Team invites',
        'Calendar',
        'First job',
        'Complete'
      ]
    },
    settings: {
      restart: 'Restart onboarding',
      restartDescription: 'Walk through setup again from the beginning.',
      restartConfirm: 'Restart setup?',
      restartSuccess: 'Onboarding restarted. Continue from the welcome screen.'
    }
  },
  empty: {
    jobs: {
      title: 'Create your first job',
      description: 'Track work, schedules, photos, and reports from one place.',
      action: 'Create job'
    },
    customers: {
      title: 'Add your first customer',
      description: 'Keep contact details and job history organized for every client.',
      action: 'Add customer'
    },
    schedule: {
      title: 'Create your first scheduled task',
      description: 'Add dates to jobs to see them on your calendar and daily views.',
      action: 'Go to jobs'
    },
    workers: {
      title: 'No workers yet',
      description: 'Invite a team member or add a worker when your plan supports crew management.',
      action: 'Invite team'
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
      description: 'Create a checklist when you want the same steps on every job.'
    },
    photos: {
      title: 'No photos yet',
      description: 'Upload before and after photos to document completed work.'
    }
  },
  legal: {
    terms: 'Terms',
    privacy: 'Privacy',
    cookies: 'Cookies',
    security: 'Security',
    footerLabel: 'Legal and policies',
    footerNav: 'Legal links'
  },
  cookies: {
    banner: {
      title: 'Cookie preferences',
      description:
        'We use essential cookies for sign-in and session security. Analytics cookies are optional and only load if you allow them.',
      policy: 'Cookie policy',
      privacy: 'Privacy policy',
      acceptAll: 'Accept all',
      reject: 'Reject non-essential',
      manage: 'Manage preferences',
      save: 'Save preferences'
    },
    categories: {
      necessary: 'Necessary',
      necessaryDesc: 'Required for authentication and core app functionality.',
      analytics: 'Analytics',
      analyticsDesc: 'Helps us understand signup and marketing page usage.',
      marketing: 'Marketing',
      marketingDesc: 'Reserved for future promotional communications.'
    }
  },
  settings: {
    privacy: {
      title: 'Privacy & data',
      description: 'Control your data, communications, and compliance preferences.',
      disclosureTitle: 'What we collect',
      disclosureBody: 'EverittOS collects only what is needed to operate your workspace.',
      collectProfile: 'Account profile: email, role, business name, and workspace settings.',
      collectOperations: 'Operational data: jobs, customers, workers, schedules, and photos you create.',
      collectActivity: 'Activity logs: actions taken in your workspace for audit and support.',
      collectPasskeys:
        'Passkeys (optional): cryptographic credentials stored on your device or password manager. EverittOS does not receive or store biometric data.',
      retention: 'Data is retained while your account is active and deleted per your account deletion request.',
      preferencesTitle: 'Communication preferences',
      marketingEmails: 'Marketing emails',
      productUpdates: 'Product updates',
      operationalNotifications: 'Operational notifications',
      doNotSell: 'Do Not Sell or Share My Information',
      doNotSellDesc: 'EverittOS does not sell personal data. Enable this to record your CCPA preference.',
      save: 'Save preferences',
      saved: 'Privacy preferences saved.',
      saveError: 'Unable to save preferences.',
      languageTitle: 'Language',
      exportTitle: 'Download your data',
      exportDescription: 'Export your profile, jobs, customers, workers, and activity as JSON.',
      exportButton: 'Download data export',
      exportSuccess: 'Your data export has started.',
      exportError: 'Unable to export data right now.',
      consentTitle: 'Legal acceptance',
      termsAccepted: 'Terms accepted',
      privacyAccepted: 'Privacy accepted',
      termsNotRecorded: 'Terms acceptance not yet recorded.',
      privacyNotRecorded: 'Privacy acceptance not yet recorded.'
    },
    notifications: {
      title: 'Notifications',
      description: 'Choose how EverittOS reaches you.',
      email: 'Email notifications',
      operational: 'Operational alerts (assignments, due dates, invites)',
      push: 'Push notifications',
      pushFuture: 'Coming soon for mobile apps.',
      sms: 'SMS notifications',
      smsFuture: 'Coming soon where supported.',
      save: 'Save notification settings',
      saved: 'Notification settings saved.',
      saveError: 'Unable to save notification settings.'
    },
    nav: {
      privacy: 'Privacy',
      notifications: 'Notifications'
    },
    security: {
      passkeysTitle: 'Passkeys',
      passkeysBody:
        'Passkeys let you sign in with your device, browser, password manager, biometric unlock, or security key. EverittOS does not receive or store biometric data.',
      compromised: 'If you believe your account or device has been compromised, contact us at'
    }
  },
  auth: {
    acceptTerms: 'I agree to the Terms of Service',
    acceptPrivacy: 'I agree to the Privacy Policy',
    consentRequired: 'You must accept the Terms of Service and Privacy Policy to create an account.',
    signInMethods: 'Sign in with email, Google, or passkey.'
  },
  nav: {
    dashboard: 'Dashboard',
    jobs: 'Jobs',
    customers: 'Customers',
    schedule: 'Schedule',
    workers: 'Workers',
    team: 'Team',
    activity: 'Activity',
    analytics: 'Analytics',
    workflows: 'Workflows',
    notifications: 'Notifications',
    billing: 'Billing',
    settings: 'Settings',
    clientPortal: 'Client portal',
    contractorPortal: 'Contractor portal'
  },
  settingsNav: {
    workspace: 'Workspace',
    team: 'Team',
    branding: 'Branding',
    integrations: 'Integrations',
    account: 'Account',
    billing: 'Billing',
    security: 'Security',
    privacy: 'Privacy',
    notifications: 'Notifications',
    api: 'API',
    departments: 'Departments'
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'What needs attention right now.',
    createJob: 'Create job',
    inviteTeam: 'Invite team member',
    viewReports: 'View reports',
    upcomingWork: 'Upcoming work',
    quickLinks: 'Quick links',
    openJobs: 'Open jobs',
    completedJobs: 'Completed jobs',
    dueSoon: 'Due in 7 days',
    reportsOnFile: 'Reports on file',
    teamMembers: 'Team members',
    recentJobs: 'Recent jobs',
    upcomingJobs: 'Upcoming jobs',
    recentActivity: 'Recent activity',
    viewAllActivity: 'View all activity',
    upgradeTitle: 'Need higher limits?',
    upgradeBody: 'Upgrade for more jobs, photos, team members, and crew assignment.',
    metricsEmpty: 'Metrics will appear after jobs, reports, and team activity are created.',
    analyticsEmpty: 'Metrics will appear after jobs, reports, and team activity are created.'
  },
  billing: {
    title: 'Billing',
    currentPlan: 'Plan',
    status: 'Status',
    renewalDate: 'Renewal date',
    manageStripe: 'Manage billing in Stripe',
    noCustomer: 'No Stripe customer on file yet. Choose a paid plan below to start checkout.',
    cancel: 'Cancel subscription',
    resume: 'Resume subscription',
    portalUnavailable: 'Stripe billing portal is not configured. Contact support for billing changes.',
    upgradeOptions: 'Upgrade options'
  },
  language: {
    title: 'Language',
    note: 'Language changes core app labels. Some legal and billing text may remain in English.'
  }
};
