import type { Messages } from '@/lib/i18n/types';

export const messages: Messages = {
  common: {
    continue: 'Continue',
    skip: 'Skip',
    skipThisStep: 'Skip this step',
    skipAllSetup: 'Skip all setup',
    cancelSetup: 'Cancel setup',
    back: 'Back',
    loading: 'Loading…',
    connect: 'Connect',
    connectLater: 'Connect Later',
    addAnother: 'Add Another',
    goToDashboard: 'Go To Dashboard',
    exploreFeatures: 'Explore Features',
    optional: 'Optional',
    language: 'Language',
    close: 'Close'
  },
  ux: {
    appName: 'EverittOS',
    mobileNavLabel: 'Main navigation',
    logOut: 'Log out',
    startPro: 'Start Pro',
    attentionNeeded: 'Attention needed',
    progressTitle: 'Your progress',
    advancedTools: 'More tools',
    helperSchedule: 'See what is on the calendar and assign work.',
    helperAnalytics: 'Business performance and trends for your workspace.',
    helperBilling: 'Invoices, payments, and your subscription.',
    pageTitles: {
      schedule: 'Calendar & work',
      analytics: 'Business performance',
      billing: 'Invoices & payments'
    }
  },
  onboarding: {
    progress: 'Step {current} of {total}',
    loading: 'Loading your workspace…',
    calendarLater: 'Calendar integration can be connected later.',
    calendarNotConfigured:
      'Calendar connection is not configured yet. You can continue and add it later from Settings.',
    calendarConnected: 'Google Calendar is connected.',
    connectGoogleCalendar: 'Connect Google Calendar',
    openIntegrations: 'Open integrations settings',
    inviteFailed: 'Invite could not be sent. You can invite team members later from Settings.',
    steps: {
      welcome: {
        title: 'Welcome to EverittOS',
        subtitle: 'A few quick steps to set up your workspace.'
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
        subtitle: 'Add your first job now, or skip and create one from your dashboard later.',
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
      small: '2-5',
      medium: '6-20',
      large: '21-50',
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
      description: 'Optional setup. Skip anytime.',
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
      restart: 'Restart setup',
      restartDescription: 'Walk through setup again from the beginning.',
      restartConfirm: 'Restart setup?',
      restartSuccess: 'Setup restarted. Continue from the welcome screen.'
    }
  },
  empty: {
    jobs: {
      title: 'No jobs yet',
      description: '',
      action: 'New job'
    },
    customers: {
      title: 'No customers yet',
      description: '',
      action: 'Add customer'
    },
    schedule: {
      title: 'Nothing scheduled',
      description: '',
      action: 'View jobs'
    },
    workers: {
      title: 'No workers yet',
      description: '',
      action: 'Invite team'
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
    today: 'Today',
    more: 'More',
    commandCenter: 'Today',
    dashboard: 'Dashboard',
    forms: 'Forms',
    templates: 'Templates',
    reviews: 'Reviews',
    leads: 'Leads',
    jobs: 'Jobs',
    crm: 'CRM',
    customers: 'Customers',
    projects: 'Projects',
    knowledge: 'Knowledge',
    automations: 'Automations',
    clients: 'Clients',
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
    aiMemory: 'AI Memory',
    departments: 'Departments'
  },
  dashboard: {
    title: 'Today',
    subtitle: 'What needs your attention right now.',
    welcome: 'Welcome back',
    welcomeName: 'Welcome back, {name}',
    newJob: 'New job',
    quickActions: {
      createJob: 'Create job',
      addCustomer: 'Add customer',
      sendInvoice: 'Send invoice',
      scheduleWork: 'Schedule work',
      addWorker: 'Add worker'
    },
    attention: {
      overdueInvoices: 'Unpaid invoices',
      unassignedJobs: 'Jobs without a worker',
      pendingEstimates: 'Open estimates',
      followUpCustomers: 'Leads to follow up',
      upcomingAppointments: 'Upcoming appointments'
    },
    progress: {
      completedWeek: 'Completed this week',
      revenueMonth: 'Collected this month',
      newCustomersMonth: 'New customers this month',
      openInvoices: 'Open invoices',
      scheduledUpcoming: 'Scheduled ahead'
    },
    sidebar: {
      todayTasks: "Today's tasks",
      notifications: 'Notifications',
      upcoming: 'Upcoming',
      crmSnapshot: 'CRM snapshot',
      viewTasks: 'View tasks',
      openInbox: 'Open inbox',
      openSchedule: 'Open schedule',
      openCrm: 'Open CRM',
      leadsClients: '{leads} leads · {clients} clients'
    },
    todaysSchedule: "Today's schedule",
    viewSchedule: 'Schedule',
    noScheduleToday: 'Nothing scheduled today',
    primaryActions: 'Quick actions',
    metricsLabel: 'Overview',
    recentActivity: 'Recent activity',
    viewActivity: 'View all',
    moreDetails: 'Plan and usage',
    finishSetup: 'Finish setup',
    actions: {
      newJob: 'New job',
      schedule: 'Schedule',
      customers: 'Customers',
      workers: 'Workers',
      billing: 'Billing'
    },
    metrics: {
      jobsToday: 'Jobs today',
      openJobs: 'Open jobs',
      completedJobs: 'Completed jobs',
      dueInSevenDays: 'Due in 7 days',
      reports: 'Reports',
      teamMembers: 'Team members',
      unpaidInvoices: 'Unpaid invoices',
      upcomingSchedule: 'Upcoming'
    },
    quickLinksLabel: 'More',
    quickLinks: {
      jobs: 'Jobs',
      notifications: 'Notifications',
      settings: 'Settings',
      activity: 'Activity'
    },
    activityEmpty: 'No activity yet',
    skipped: {
      label: 'Still open:',
      createJob: 'Create job',
      addCustomer: 'Add customer',
      inviteTeam: 'Invite team',
      connectCalendar: 'Connect calendar'
    },
    metricsEmpty: 'No metrics yet',
    analyticsEmpty: 'No metrics yet'
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
