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
        title: 'Work focus',
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
          'You can now manage jobs, customers, schedules, people, and operations from your dashboard.'
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
      workers: 'People',
      maintenance: 'Maintenance',
      cleaning: 'Cleaning',
      inspections: 'Inspections',
      other: 'Other'
    },
    roles: {
      admin: 'Admin',
      manager: 'Manager',
      worker: 'Employee'
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
        'Work focus',
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
      title: 'No people yet',
      description: 'Invite people so you can assign jobs and manage access.',
      action: 'Invite person'
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
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    refundPolicy: 'No Refund Policy',
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
      collectOperations: 'Operational data: jobs, customers, people, schedules, and photos you create.',
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
      exportDescription: 'Export your profile, jobs, customers, people, and activity as JSON.',
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
      languageNote: 'Applies to navigation, dashboard, jobs, customers, bookings, people, schedule, billing, settings, and common buttons.',
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
    agreeToTermsPrefix: 'I agree to the',
    agreeToTermsAnd: 'and',
    continuingLegalPrefix: 'By continuing, you agree to the',
    continuingLegalAcknowledge: ', acknowledge the',
    continuingLegalUnderstand: ', and understand our',
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
    services: 'Services',
    bookings: 'Bookings',
    jobs: 'Jobs',
    crm: 'Customers',
    customers: 'Customers',
    projects: 'Projects',
    knowledge: 'Knowledge',
    automations: 'Automations',
    clients: 'Clients',
    schedule: 'Schedule',
    expenses: 'Expenses',
    workers: 'People',
    team: 'People',
    activity: 'Activity',
    analytics: 'Analytics',
    workflows: 'Workflows',
    notifications: 'Notifications',
    billing: 'Plans & billing',
    settings: 'Settings',
    clientPortal: 'Client portal',
    contractorPortal: 'Contractor portal',
    sectionTools: 'Tools',
    sectionInsights: 'Insights',
    inventory: 'Inventory',
    routes: 'Routes',
    photos: 'Photos'
  },
  settingsNav: {
    workspace: 'Workspace',
    team: 'People',
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
    aiUsage: 'AI Usage',
    departments: 'Departments'
  },
  supportTraining: {
    pricingHeadline: 'Need help getting started?',
    pricingBody:
      'Book a free 30-minute onboarding call and we’ll help you set up your first customers, jobs, people, schedule, invoices, and SOPs.',
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
      'Book a free 30-minute onboarding call and we’ll help you set up your first customers, jobs, people, schedule, invoices, and SOPs.',
    settingsTitle: 'Support & Training',
    settingsDescription: 'Onboarding, SOP setup, and team training from the Everitt team.',
    settingsEmailNote: 'You can also email us at',
    contactEverittTeam: 'Contact Everitt Team'
  },
  dashboard: {
    title: 'Today',
    subtitle: 'What needs your attention right now.',
    navSubtitle: 'Use the menu or Ask Everitt to open customers, jobs, photos, schedule, invoices, team, and settings.',
    helpAriaLabel: 'EverittOS support',
    welcome: 'Welcome back',
    welcomeName: 'Welcome back, {name}',
    subtitleToday: "Here's what's happening today.",
    newJob: 'New job',
    quickActions: {
      createJob: 'Create job',
      addCustomer: 'Add customer',
      sendInvoice: 'Send invoice',
      scheduleWork: 'Schedule work',
      addWorker: 'Invite person'
    },
    attention: {
      overdueInvoices: 'Unpaid invoices',
      unassignedJobs: 'Unassigned jobs',
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
      overdueInvoices: 'Overdue invoices',
      jobsCompleted: 'Jobs completed',
      completedThisMonth: 'Completed this month',
      upcomingJobs: 'Upcoming jobs',
      activeCustomers: 'Active customers',
      expensesMonth: 'Expenses this month',
      netEstimate: 'Net estimate',
      bookingsMonth: 'Bookings this month',
      messagesCount: 'Messages',
      reportsCount: 'Reports',
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
      workers: 'People',
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
    analyticsEmpty: 'Metrics will appear after jobs, reports, and team activity are created.',
    teamCommand: {
      ariaLabel: 'Team Command Center',
      title: 'Team Command Center',
      subtitle: 'See who is available, scheduled, or needs attention today.',
      loading: 'Loading team command center...',
      loadError: 'We could not load team command center data. Refresh and try again.',
      metrics: {
        onJob: 'On job',
        dueToday: 'Due today',
        needsAttention: 'Needs attention',
        availableTeam: 'Available team'
      },
      overview: {
        title: 'Team overview',
        description: 'Open a team member to view schedule, assignment, and contact actions.',
        empty: 'No team members yet. Invite team members or assign jobs to see workload here.'
      },
      status: {
        needsAttention: 'Needs attention',
        onJob: 'On job',
        scheduled: 'Scheduled',
        overloaded: 'Overloaded',
        available: 'Available'
      },
      summary: {
        readyForAssignment: 'Ready for assignment',
        activeJobsOne: '{count} active job',
        activeJobsMany: '{count} active jobs',
        dueTodayCount: '{count} due today',
        nextPrefix: 'Next:',
        updatedPrefix: 'Updated:',
        notUpdatedYet: 'Not updated yet'
      },
      member: {
        defaultName: 'Team member',
        active: 'Active',
        dueToday: 'Due today',
        overdue: 'Overdue',
        completed: 'Completed',
        nextAssignment: 'Next assignment',
        noScheduledAssignment: 'No scheduled assignment yet.',
        assignedDateNotScheduled: 'Assigned, date not scheduled',
        contact: 'Contact',
        noEmailOnFile: 'No email on file',
        viewSchedule: 'View schedule',
        viewJobs: 'View jobs',
        assignJob: 'Assign job'
      }
    },
    role: {
      workspaceTitle: 'Your workspace',
      workspaceTitleTeam: 'Team command center',
      workspaceIntro: 'Track your active work, schedule, photos, reports, and team activity.',
      workspaceIntroTeam: 'Owner and admin view across this workspace only. Each card opens the records behind the number.',
      viewTeam: 'View team',
      manageAccess: 'Manage access',
      teamOverview: 'Team overview',
      teamOverviewHint: "See each person's workload without leaving the owner dashboard.",
      noTeamMembers: 'No active team members found.',
      lastActivity: 'Last activity:',
      viewWorkload: 'View workload',
      upcomingTeamJobs: 'Upcoming team jobs',
      upcomingJobs: 'Upcoming jobs',
      openSchedule: 'Open schedule',
      noUpcomingDueDates: 'No upcoming due dates.',
      recentTeamActivity: 'Recent team activity',
      viewAuditTrail: 'View audit trail',
      noRecentActivity: 'No recent activity yet.',
      teamMember: 'Team member',
      quickOwnerActions: 'Quick owner actions',
      assignJob: 'Assign job',
      quickActions: {
        messageTeam: 'Message team',
        reviewReports: 'Review reports',
        viewSchedule: 'View schedule'
      },
      metrics: {
        teamActiveJobs: 'Team active jobs',
        activeJobs: 'Active jobs',
        teamCompletedJobs: 'Team completed jobs',
        completed: 'Completed',
        teamOverdueJobs: 'Team overdue jobs',
        overdue: 'Overdue',
        customers: 'Customers',
        teamMembers: 'Team members',
        teamPhotos: 'Team photos',
        teamReports: 'Team reports',
        teamActivity: 'Team activity',
        teamJobsThisMonth: 'Team jobs this month',
        jobsThisMonth: 'Jobs this month',
        active: 'Active',
        dueToday: 'Due today'
      },
      workload: {
        inactive: 'Inactive',
        overloaded: 'Overloaded',
        busy: 'Busy',
        available: 'Available'
      },
      field: {
        title: 'My field work',
        intro: 'A simple view for assigned jobs, photos, checklist work, and customer contact.',
        myActiveJobs: 'My active jobs',
        dueToday: 'Due today',
        completed: 'Completed',
        photosUploaded: 'Photos uploaded',
        currentJob: 'Current job',
        currentJobHint: 'Open the job to start, complete checklist items, upload photos, or mark it complete.',
        openJob: 'Open job',
        noCustomerDetails: 'No customer details added',
        startOrFinish: 'Start or finish job',
        callCustomer: 'Call customer',
        startNavigation: 'Start navigation',
        noAssignedWork: 'No assigned field work',
        noAssignedWorkHint: 'Jobs assigned to you will appear here with status, customer contact, photos, and checklist actions.',
        myJobsToday: 'My jobs today',
        viewAll: 'View all',
        noJobsToday: 'No jobs due today.',
        noLocation: 'No location added',
        nextAssignedJobs: 'Next assigned jobs',
        noUpcomingAssigned: 'No upcoming assigned jobs.',
        noActivityYet: 'No activity yet',
        notScheduled: 'Not scheduled'
      }
    }
  },
  billing: {
    title: 'Plans & billing',
    description: 'Manage your subscription, compare plans, and upgrade when you are ready.',
    pricingTitle: 'Plans and pricing',
    pricingSubtitle: 'Compare plans side by side. Choose any paid plan that fits your workspace.',
    pricingPublicLead:
      'Compare plans side by side. Start free or upgrade when you are ready — subscriptions renew monthly until canceled.',
    pricingLoading: 'Loading plans…',
    planChangeIntro:
      'New subscriptions start in Stripe Checkout. Upgrades, downgrades, and cancellations use Manage billing when you already have a subscription.',
    cancelViaPortal: 'Canceling keeps access until the end of the current billing period. Cancellations are final and non-refundable.',
    upgradeDowngradeViaPortal:
      'To upgrade or downgrade an existing subscription, open Manage billing and change your plan in Stripe.',
    openingPortal: 'Opening billing portal…',
    pricingNav: {
      signIn: 'Sign in',
      createAccount: 'Create account',
      dashboard: 'Dashboard',
      billing: 'Billing',
      account: 'Account'
    },
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
    alreadySubscribedPortal: 'You already have an active subscription. Use Manage billing to upgrade, downgrade, or cancel.',
    downgradeSupportNote: 'Moving to the free plan requires billing support.',
    plansFootnote:
      'Subscriptions renew automatically until canceled. All payments are final and non-refundable once processed.',
    portalUnavailable: 'Billing portal is not configured yet.',
    portalNotConfigured: 'Billing portal is not configured yet.',
    upgradeOptions: 'Upgrade options',
    upgrade: 'Upgrade',
    health: {
      title: 'Billing status',
      description: 'A quick overview of how your workspace billing is connected and syncing.',
      loading: 'Loading billing status…',
      loadFailed: 'Unable to load billing status right now. Please try again in a moment.',
      currentPlan: 'Current plan',
      accountStatus: 'Account status',
      technicalDetails: 'View technical details',
      status: {
        connected: 'Connected',
        needs_attention: 'Needs attention',
        action_required: 'Action required'
      },
      summary: {
        connected: 'Your billing is fully connected and syncing.',
        needs_attention: 'Some billing items need attention. Review the status below.',
        action_required: 'Billing needs attention before paid features can stay reliable.'
      },
      cards: {
        stripeAccount: {
          connected: {
            title: 'Stripe account connected',
            description: 'Your workspace is linked to a Stripe customer account.'
          },
          needs_attention: {
            title: 'Stripe account not connected yet',
            description: 'Complete checkout or sync billing to connect your Stripe account.'
          },
          action_required: {
            title: 'Stripe account not connected yet',
            description: 'Complete checkout or sync billing to connect your Stripe account.'
          }
        },
        subscriptionInfo: {
          connected: {
            title: 'Subscription information is up to date',
            description: 'Your plan and subscription details are available in EverittOS.'
          },
          needs_attention: {
            title: 'Subscription information is still syncing',
            description: 'We are finishing the link between your plan and Stripe. This usually resolves after checkout or a sync.'
          },
          action_required: {
            title: 'Subscription information is still syncing',
            description: 'We are finishing the link between your plan and Stripe. This usually resolves after checkout or a sync.'
          }
        },
        billingConfiguration: {
          connected: {
            title: 'Billing configuration is ready',
            description: 'Upgrade paths and plan pricing are available for this workspace.'
          },
          needs_attention: {
            title: 'Billing configuration requires review',
            description: 'Some plan pricing still needs to be finalized. Contact support if upgrades are unavailable.'
          },
          action_required: {
            title: 'Billing configuration requires review',
            description: 'Some plan pricing still needs to be finalized. Contact support if upgrades are unavailable.'
          }
        },
        subscriptionSync: {
          connected: {
            title: 'Subscription sync completed',
            description: 'Stripe subscription updates have been received successfully.'
          },
          needs_attention: {
            title: 'Subscription sync has not completed yet',
            description: 'We have not recorded a completed Stripe sync for this account yet. Try syncing again after checkout.'
          },
          action_required: {
            title: 'Subscription sync needs attention',
            description: 'The latest Stripe sync did not complete successfully. Try syncing again or contact support.'
          }
        },
        billingService: {
          connected: {
            title: 'Billing service is available',
            description: 'EverittOS can communicate with Stripe for this workspace.'
          },
          needs_attention: {
            title: 'Billing service needs attention',
            description: 'Billing connectivity is limited right now. Try again shortly or contact support.'
          },
          action_required: {
            title: 'Billing service needs attention',
            description: 'Billing connectivity is limited right now. Try again shortly or contact support.'
          }
        }
      },
      technical: {
        profilePlan: 'Profile plan (raw)',
        subscriptionStatus: 'Subscription status (raw)',
        stripeCustomerId: 'Stripe customer ID',
        stripeSubscriptionId: 'Stripe subscription ID',
        stripePriceId: 'Stripe price ID',
        latestWebhook: 'Latest webhook sync',
        notSet: 'Not set',
        noWebhookYet: 'No webhook sync recorded yet',
        webhookSuccess: 'Synced from {event}',
        webhookFailed: 'Sync failed: {reason}',
        unknown: 'unknown',
        stripeConfigured: 'Stripe API configured',
        webhookConfigured: 'Stripe webhook configured',
        checkoutConfigured: 'Checkout prices configured',
        yes: 'Yes',
        no: 'No',
        noIssues: 'No internal diagnostic codes reported.'
      }
    },
    promo: {
      label: 'Promo code',
      applyBeforeCheckout: 'Apply a promo code before choosing a paid plan.',
      previewFor: 'Preview for',
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
      checkoutActivated: 'Payment successful — your plan is now active.',
      checkoutSyncing:
        'Payment received, but plan activation is still syncing. Refresh or contact support if it does not update.',
      checkoutInactive: 'Payment failed or subscription inactive.',
      checkoutCancelled: 'Checkout was cancelled. No charge was made.',
      checkoutFailed: 'Unable to start checkout. Try again or contact support.',
      startingCheckout: 'Starting checkout…',
      applyFirst: 'Apply a valid promo code before checkout.',
      signInNote: 'Already have an account?'
    },
    noRefund: {
      policyShort: 'All payments are final. No refunds once payment is processed.',
      policyFull:
        'All payments are final. EverittOS does not offer refunds for subscriptions, setup fees, digital services, AI usage, workspace access, add-ons, or partially used billing periods. You may cancel anytime to stop future renewals, but prior charges are non-refundable.',
      checkoutAck: 'I understand all payments are final and non-refundable.',
      ackRequired: 'Confirm the no-refund policy before checkout.',
      cancelNote: 'Canceling stops future renewals only. Prior charges are non-refundable.'
    },
    aiAccess: {
      title: 'AI access',
      askEverittIncluded: 'Ask Everitt search is included on every plan.',
      everittAiPlans: 'Everitt AI is available on Business and Enterprise plans.',
      includedOnPlan: 'Everitt AI is included on your {plan} plan.',
      upgradeCta: 'Upgrade to unlock Everitt AI',
      viewUsageLink: 'View detailed AI usage and staff metrics'
    }
  },
  aiUsage: {
    title: 'AI Usage',
    description: 'Prompt counts, estimated costs, quota tracking, and staff usage metrics for workspace admins.',
    adminOnly: 'Only workspace owners and admins can view AI usage metrics.'
  },
  language: {
    title: 'Language',
    note: 'Language changes core app labels. Some legal and billing text may remain in English.'
  },
  feedback: {
    saved: 'Saved',
    updated: 'Updated',
    created: 'Created',
    deleted: 'Deleted',
    sent: 'Sent',
    submitted: 'Submitted',
    connected: 'Connected',
    disconnected: 'Disconnected',
    uploadComplete: 'Upload complete',
    syncComplete: 'Sync complete',
    copied: 'Copied',
    removed: 'Removed',
    invited: 'Invitation sent',
    paymentRecorded: 'Payment recorded',
    loading: 'Working…',
    genericError: 'Something went wrong. Try again.',
    requestFailed: 'Request failed.'
  },
  pages: {
    invoices: {
      title: 'Invoices',
      subtitle: 'Send invoices to customers in one step. Amount and message auto-save while you compose.',
      loading: 'Loading invoices…'
    },
    messages: {
      title: 'Messages',
      subtitle: 'Email-first customer messaging. Threads keep sent and failed delivery history in one place.'
    },
    inventory: {
      title: 'Inventory',
      subtitle: 'Track supplies and equipment. Adjustments update quantity and keep an audit trail.',
      noAccess: 'You do not have access to inventory.',
      schemaNotReady: 'Inventory tables are not set up yet. Run the latest Supabase migrations, then refresh.',
      addItem: 'Add item',
      close: 'Close',
      name: 'Name',
      category: 'Category',
      quantity: 'Quantity',
      unit: 'Unit',
      reorderLevel: 'Reorder level',
      saveItem: 'Save item',
      saving: 'Saving…',
      loading: 'Loading inventory…',
      empty: 'No inventory items yet.',
      colItem: 'Item',
      colQty: 'Qty',
      colReorder: 'Reorder',
      colLocation: 'Location',
      lowStock: 'Low stock',
      adjust: 'Adjust',
      adjustPlaceholder: '+/-',
      loadError: 'Unable to load inventory.',
      createError: 'Unable to create item.',
      adjustError: 'Unable to adjust quantity.'
    },
    routes: {
      title: 'Route planning',
      subtitle: 'Basic job ordering by address and schedule. Not true drive-time optimization.',
      buildRoute: 'Build route',
      building: 'Building…',
      loading: 'Loading route runs…',
      empty: 'No route runs yet.',
      colDate: 'Date',
      colStatus: 'Status',
      colStops: 'Stops',
      view: 'View',
      apply: 'Apply',
      stopsFor: 'Stops for {date}',
      missingAddress: 'Missing address',
      addressNeeded: 'address needed',
      applyConfirm: 'Apply this route order to scheduled jobs?',
      optimizeError: 'Unable to build route.',
      applyError: 'Unable to apply route.'
    },
    recurring: {
      title: 'Recurring invoices',
      subtitle: 'Generate draft invoices on a schedule. Nothing is auto-charged or auto-sent.',
      schemaNotReady: 'Recurring invoice tables are not set up yet. Run the latest Supabase migrations, then refresh.',
      addTemplate: 'Add template',
      close: 'Close',
      titleField: 'Title',
      amount: 'Amount',
      nextRun: 'Next run',
      saveTemplate: 'Save template',
      saving: 'Saving…',
      loading: 'Loading recurring templates…',
      empty: 'No recurring invoice templates yet.',
      colTitle: 'Title',
      colAmount: 'Amount',
      colCadence: 'Cadence',
      colNextRun: 'Next run',
      colStatus: 'Status',
      notSet: 'Not set',
      active: 'Active',
      paused: 'Paused',
      runNow: 'Run now',
      running: 'Running…',
      pause: 'Pause',
      resume: 'Resume',
      recentRuns: 'Recent runs',
      invoiceCreated: 'Invoice created',
      loadError: 'Unable to load recurring invoices.',
      createError: 'Unable to create template.',
      updateError: 'Unable to update template.',
      runError: 'Unable to run template.',
      draftCreated: 'Draft invoice created. Check the Drafts tab above.',
      cadence: { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }
    },
    customerMessages: {
      schemaNotReady: 'Customer messaging tables are not set up yet. Run the latest Supabase migrations, then refresh.',
      composeTitle: 'Compose message',
      recipientEmail: 'Recipient email',
      subject: 'Subject',
      message: 'Message',
      sendEmail: 'Send email',
      sending: 'Sending…',
      threads: 'Threads',
      loadingThreads: 'Loading threads…',
      emptyThreads: 'No customer message threads yet.',
      colSubject: 'Subject',
      colStatus: 'Status',
      colLastMessage: 'Last message',
      open: 'Open',
      noSubject: 'No subject',
      thread: 'Thread',
      reply: 'Reply',
      sendReply: 'Send reply',
      loadError: 'Unable to load messages.',
      threadLoadError: 'Unable to load thread.',
      sendError: 'Unable to send message.',
      replyError: 'Unable to send reply.',
      emailFailed: 'Email failed. Message saved with failed status.'
    },
    quickbooks: {
      loading: 'Loading QuickBooks status…',
      loadError: 'Unable to load QuickBooks status.',
      statusLabel: 'Status',
      connected: 'Connected',
      notConnected: 'Not connected',
      notConfigured: 'Server not configured',
      lastSync: 'Last sync',
      connect: 'Connect QuickBooks',
      disconnect: 'Disconnect QuickBooks',
      recentSyncLog: 'Recent sync log',
      noSyncAttempts: 'No sync attempts yet.',
      connectFailed: 'QuickBooks connection failed ({reason}).'
    },
    customers: { notFound: 'Customer not found' },
    jobs: {
      notFound: 'Job not found',
      needsAssignment: 'Needs assignment',
      showAll: 'Show all jobs',
      assignedEmail: 'Assigned email',
      assignedEmailHint: 'Optional. Who should receive this job. No People record required.',
      createTitle: 'Create a job',
      createPermissionBlocked: 'You do not have access to create jobs on this account.'
    }
  }
};
