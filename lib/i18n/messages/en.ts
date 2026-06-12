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
    close: 'Close',
    cancel: 'Cancel'
  },
  ux: {
    appName: 'EverittOS',
    mobileNavLabel: 'Main navigation',
    logOut: 'Log out',
    startPro: 'Start Pro',
    viewPlans: 'View plans',
    attentionNeeded: 'Attention needed',
    progressTitle: 'Your progress',
    advancedTools: 'More tools',
    helperSchedule: 'See what is on the calendar and assign work.',
    helperAnalytics: 'Business performance and trends for your workspace.',
    helperBilling: 'Invoices, payments, and your subscription.',
    pageTitles: {
      schedule: 'Calendar & work',
      analytics: 'Business performance',
      billing: 'Invoices & payments',
      customers: 'Track customers, leads, and follow-ups in one place.'
    },
    tapHint: 'Tap to view details'
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
    teamUpgradeRequired: 'Team invites require Business or higher. Upgrade billing to invite teammates.',
    inviteLinkReady: 'Invitation created. Copy the invite link below because email is not configured.',
    inviteLinkCopied: 'Invite link copied.',
    copyInviteLink: 'Copy invite link',
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
      description: 'Create your first job to start tracking work.',
      action: 'Create job'
    },
    customers: {
      title: 'No customers yet',
      description:
        'Add your first customer to start tracking jobs, notes, invoices, and follow-ups.',
      action: 'Add customer'
    },
    leads: {
      title: 'No leads yet',
      description: 'Capture your first lead to track sources, follow-ups, and conversion.',
      action: 'Add lead',
      secondaryAction: 'Create a form'
    },
    schedule: {
      title: 'Nothing scheduled',
      description: 'Schedule your first appointment to see work on the calendar.',
      action: 'Schedule work'
    },
    workers: {
      title: 'No workers yet',
      description: 'Add team members so you can assign jobs and track who is doing what.',
      action: 'Add worker'
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
      title: 'No before/after photos yet',
      description: 'Upload before and after photos to document completed work and share results.'
    },
    reviews: {
      title: 'No reviews yet',
      description: 'Send a review request after a job to collect customer feedback.',
      action: 'Send review request'
    },
    forms: {
      title: 'No forms yet',
      description: 'Create a form to capture leads from your website or social channels.',
      action: 'Create form'
    },
    templates: {
      title: 'No templates yet',
      description: 'Save reusable proposals, SOPs, emails, and checklists for your team.',
      action: 'New template'
    },
    expenses: {
      title: 'No expenses yet',
      description: 'Track spending by job to understand profit and business performance.',
      action: 'Add expense'
    },
    invoices: {
      title: 'No invoices yet',
      description: 'Send your first invoice to collect payment for completed work.',
      action: 'Send invoice'
    },
    analytics: {
      title: 'No analytics yet',
      description: 'Create customers, jobs, and invoices to see revenue and performance insights.',
      action: 'Go to dashboard'
    }
  },
  legal: {
    terms: 'Terms',
    privacy: 'Privacy',
    cookies: 'Cookies',
    security: 'Security',
    support: 'Support',
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
        'Passkey support is not enabled yet. If added later, credentials would stay on your device. EverittOS would not receive or store biometric data.',
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
      passkeysBody: 'Add passkeys for faster, phishing-resistant sign-in on supported devices.',
      compromised: 'If you believe your account or device has been compromised, contact us at'
    },
    account: {
      description: 'Email, role, subscription, and account status.',
      profile: 'Profile',
      email: 'Email',
      role: 'Role',
      accountStatus: 'Account status',
      active: 'Active',
      disabled: 'Disabled',
      manageBilling: 'Manage billing',
      workspaceSettings: 'Workspace settings',
      subscription: 'Subscription',
      subscriptionNote: 'Cancel, resume, or change plans from billing settings.',
      subscriptionOwnerOnly: 'Only workspace owners and admins can change billing.',
      openBilling: 'Open billing settings',
      languageTitle: 'Language',
      languageNote: 'Applies to navigation, dashboard, jobs, customers, workers, schedule, billing, settings, and common buttons.',
      disableTitle: 'Disable account',
      disableNote:
        'Disabling signs you out and blocks sign-in. Your organization data stays stored. Nothing is deleted.',
      ownerDisableWarning: 'You are the workspace owner. Disabling only blocks your account. Transfer ownership on',
      restoreContact: 'Contact support to restore access:',
      disabling: 'Disabling…',
      disableConfirmTitle: 'Disable your account?',
      disableConfirmBody: 'You will be signed out and cannot access protected pages until support restores access.',
      disableFailed: 'Unable to disable account.',
      disabledDetail: 'Account disabled at your request.'
    }
  },
  analytics: {
    adoption: 'Adoption metrics',
    growth: 'Growth metrics',
    usage: 'Usage metrics'
  },
  auth: {
    acceptTerms: 'I agree to the Terms of Service',
    acceptPrivacy: 'I agree to the Privacy Policy',
    acceptTermsAndPrivacy: 'I agree to the Terms of Service and Privacy Policy',
    consentRequired: 'You must accept the Terms of Service and Privacy Policy to create an account.',
    signInMethods: 'Sign in with your email and password, or use a passkey if you added one.',
    signUpMethods: 'Create an account with email and password. You can add a passkey after signup.'
  },
  nav: {
    today: 'Today',
    money: 'Money',
    more: 'More',
    commandCenter: 'Dashboard',
    dashboard: 'Dashboard',
    forms: 'Forms',
    templates: 'Templates',
    reviews: 'Reviews',
    proposals: 'Proposals',
    estimates: 'Estimates',
    invoices: 'Invoices',
    messages: 'Messages',
    leads: 'Leads',
    jobs: 'Jobs',
    crm: 'Customers',
    customers: 'Customers',
    projects: 'Projects',
    knowledge: 'Knowledge',
    automations: 'Automations',
    clients: 'Clients',
    schedule: 'Schedule',
    expenses: 'Expenses',
    workers: 'Workers',
    team: 'Team',
    activity: 'Activity',
    analytics: 'Analytics',
    workflows: 'Workflows',
    notifications: 'Notifications',
    billing: 'Plans & billing',
    settings: 'Settings',
    clientPortal: 'Client portal',
    contractorPortal: 'Contractor portal',
    sectionTools: 'Tools',
    sectionInsights: 'Insights'
  },
  settingsNav: {
    workspace: 'Workspace',
    team: 'Team',
    branding: 'Branding',
    integrations: 'Integrations',
    account: 'Account',
    billing: 'Plans & billing',
    security: 'Security',
    privacy: 'Privacy',
    notifications: 'Notifications',
    supportTraining: 'Support & Training',
    api: 'API',
    aiMemory: 'AI Memory',
    departments: 'Departments'
  },
  supportTraining: {
    pricingHeadline: 'Need help getting started?',
    pricingBody:
      'Book a free 30-minute onboarding call and we’ll help you set up your first customers, jobs, workers, schedule, invoices, and SOPs.',
    itemOnboardingCall: 'Free 30-minute onboarding call',
    itemSopSetup: 'SOP setup available',
    itemTeamTraining: 'Team training available',
    bookOnboardingCall: 'Book Free Onboarding Call',
    welcomeTitle: 'Welcome to EverittOS.',
    welcomeBody:
      'Need help getting started? Book a free 30-minute onboarding call and we’ll help configure your account.',
    bookFreeCall: 'Book Free Call',
    dashboardTitle: 'Need help setting up EverittOS?',
    dashboardBody:
      'Book a free 30-minute onboarding call and we’ll help you set up your first customers, jobs, workers, schedule, invoices, and SOPs.',
    settingsTitle: 'Support & Training',
    settingsDescription: 'Onboarding, SOP setup, and team training from the Everitt team.',
    settingsEmailNote: 'You can also email us at',
    contactEverittTeam: 'Contact Everitt Team'
  },
  dashboard: {
    title: 'Today',
    subtitle: 'What needs your attention right now.',
    welcome: 'Welcome back',
    welcomeName: 'Welcome back, {name}',
    subtitleToday: "Here's what's happening today.",
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
      scheduledUpcoming: 'Scheduled ahead',
      hints: {
        completedWeek: 'Tap to view completed jobs',
        revenueMonth: 'Tap to view payments',
        newCustomersMonth: 'Tap to view new customers',
        openInvoices: 'Tap to view open invoices',
        scheduledUpcoming: 'Tap to view upcoming work'
      }
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
      leadsClients: '{leads} leads · {clients} clients',
      hints: {
        todayTasks: 'Tap to view open tasks',
        notifications: 'Tap to open your inbox',
        upcoming: 'Tap to view the calendar',
        crmSnapshot: 'Tap to open customers'
      }
    },
    todaysSchedule: "Today's schedule",
    viewSchedule: 'Schedule',
    noScheduleToday: 'Nothing scheduled today',
    upcomingJobs: 'Upcoming jobs',
    noUpcomingJobs: 'No upcoming jobs in the next two weeks.',
    customersAndLeads: 'Customers & leads',
    noCustomersOrLeads: 'No customers or leads yet. Add your first customer or lead to get started.',
    businessActivity: 'Recent business activity',
    businessActivityEmpty:
      'No business activity yet. Create your first customer, lead, or job to get started.',
    revenue: {
      title: 'Revenue snapshot',
      revenueMonth: 'Revenue this month',
      outstanding: 'Outstanding invoices',
      jobsCompleted: 'Jobs completed',
      activeCustomers: 'Active customers',
      viewAnalytics: 'Analytics'
    },
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
    analyticsEmpty: 'Metrics will appear after jobs, reports, and team activity are created.'
  },
  billing: {
    title: 'Plans & billing',
    description: 'Subscription status, usage, and plan changes.',
    pricingTitle: 'Plans and pricing',
    pricingSubtitle: 'Compare plans side by side. Choose any paid plan that fits your workspace.',
    allPlans: 'All plans',
    currentPlan: 'Plan',
    currentPlanBadge: 'Current plan',
    status: 'Status',
    renewalDate: 'Renewal date',
    manageStripe: 'Manage billing in Stripe',
    manageBilling: 'Manage billing',
    noCustomer: 'No Stripe customer on file yet. Choose a paid plan below to start checkout.',
    cancel: 'Cancel subscription',
    cancelPlan: 'Cancel plan',
    resume: 'Resume subscription',
    resumePlan: 'Resume plan',
    contactBillingSupport: 'Contact billing support',
    planChangesSupport: 'Plan changes are handled through billing support for now.',
    downgradeSupportNote: 'Moving to the free plan requires billing support.',
    plansFootnote: 'Subscriptions renew automatically until canceled. Cancel anytime from billing or the customer portal.',
    portalUnavailable: 'Billing portal is not configured yet.',
    portalNotConfigured: 'Billing portal is not configured yet.',
    upgradeOptions: 'Upgrade options',
    upgrade: 'Upgrade',
    promo: {
      label: 'Promo code',
      placeholder: 'Enter promo code',
      apply: 'Apply',
      validating: 'Validating…',
      invalid: 'This promo code is not valid.',
      applied: 'Promo code applied: {code}',
      savings: 'You save {amount} per month',
      expires: 'Code expires {date}',
      expiresLabel: 'Expires',
      activeTitle: 'Active discount',
      couponName: 'Coupon',
      code: 'Promo code',
      discount: 'Discount',
      checkoutNote: 'Discounts are validated by Stripe before checkout. Prices update after you apply a code.',
      checkoutSuccess: 'Checkout completed. Your subscription will update shortly.',
      checkoutCancelled: 'Checkout was cancelled. No charge was made.',
      checkoutFailed: 'Unable to start checkout. Try again or contact support.',
      startingCheckout: 'Starting checkout…',
      applyFirst: 'Apply a valid promo code before checkout.',
      signInNote: 'Already have an account?'
    }
  },
  language: {
    title: 'Language',
    note: 'Language changes core app labels. Some legal and billing text may remain in English.'
  }
};
