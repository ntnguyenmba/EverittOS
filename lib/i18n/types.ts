export type MessageTree = {
  common: {
    continue: string;
    skip: string;
    skipSetup: string;
    skipForNow: string;
    back: string;
    loading: string;
    connect: string;
    connectLater: string;
    addAnother: string;
    goToDashboard: string;
    exploreFeatures: string;
    optional: string;
    language: string;
  };
  onboarding: {
    progress: string;
    skipEntire: string;
    loading: string;
    calendarLater: string;
    calendarNotConfigured: string;
    calendarConnected: string;
    connectGoogleCalendar: string;
    openIntegrations: string;
    inviteFailed: string;
    steps: {
      welcome: { title: string; subtitle: string };
      business: { title: string; subtitle: string; companyName: string; industry: string; teamSize: string };
      operations: { title: string; subtitle: string };
      team: { title: string; subtitle: string; email: string; role: string };
      calendar: { title: string; subtitle: string; google: string };
      firstJob: { title: string; subtitle: string; jobName: string; customer: string; date: string };
      complete: { title: string; message: string };
    };
    industries: Record<string, string>;
    teamSizes: Record<string, string>;
    operations: Record<string, string>;
    roles: Record<string, string>;
    checklist: {
      title: string;
      description: string;
      dismiss: string;
      continue: string;
      settings: string;
      steps: string[];
    };
    settings: {
      restart: string;
      restartDescription: string;
      restartConfirm: string;
      restartSuccess: string;
    };
  };
  empty: {
    jobs: { title: string; description: string; action: string };
    customers: { title: string; description: string; action: string };
    schedule: { title: string; description: string; action: string };
    workers: { title: string; description: string; action: string };
    activity: { title: string; description: string };
    notifications: { title: string; description: string };
    workflows: { title: string; description: string };
    photos: { title: string; description: string };
  };
  legal: {
    terms: string;
    privacy: string;
    cookies: string;
    security: string;
    footerLabel: string;
    footerNav: string;
  };
  cookies: {
    banner: {
      title: string;
      description: string;
      policy: string;
      privacy: string;
      acceptAll: string;
      reject: string;
      manage: string;
      save: string;
    };
    categories: {
      necessary: string;
      necessaryDesc: string;
      analytics: string;
      analyticsDesc: string;
      marketing: string;
      marketingDesc: string;
    };
  };
  settings: {
    privacy: {
      title: string;
      description: string;
      disclosureTitle: string;
      disclosureBody: string;
      collectProfile: string;
      collectOperations: string;
      collectActivity: string;
      collectPasskeys: string;
      retention: string;
      preferencesTitle: string;
      marketingEmails: string;
      productUpdates: string;
      operationalNotifications: string;
      doNotSell: string;
      doNotSellDesc: string;
      save: string;
      saved: string;
      saveError: string;
      languageTitle: string;
      exportTitle: string;
      exportDescription: string;
      exportButton: string;
      exportSuccess: string;
      exportError: string;
      consentTitle: string;
      termsAccepted: string;
      privacyAccepted: string;
      termsNotRecorded: string;
      privacyNotRecorded: string;
    };
    notifications: {
      title: string;
      description: string;
      email: string;
      operational: string;
      push: string;
      pushFuture: string;
      sms: string;
      smsFuture: string;
      save: string;
      saved: string;
      saveError: string;
    };
    nav: {
      privacy: string;
      notifications: string;
    };
    security: {
      passkeysTitle: string;
      passkeysBody: string;
      compromised: string;
    };
  };
  auth: {
    acceptTerms: string;
    acceptPrivacy: string;
    consentRequired: string;
    signInMethods: string;
  };
  nav: {
    dashboard: string;
    jobs: string;
    customers: string;
    schedule: string;
    workers: string;
    team: string;
    activity: string;
    analytics: string;
    workflows: string;
    notifications: string;
    billing: string;
    settings: string;
    clientPortal: string;
    contractorPortal: string;
  };
  settingsNav: {
    workspace: string;
    team: string;
    branding: string;
    integrations: string;
    account: string;
    billing: string;
    security: string;
    privacy: string;
    notifications: string;
    api: string;
    departments: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    createJob: string;
    inviteTeam: string;
    viewReports: string;
    upcomingWork: string;
    quickLinks: string;
    openJobs: string;
    completedJobs: string;
    dueSoon: string;
    reportsOnFile: string;
    teamMembers: string;
    recentJobs: string;
    upcomingJobs: string;
    recentActivity: string;
    viewAllActivity: string;
    upgradeTitle: string;
    upgradeBody: string;
    metricsEmpty: string;
    analyticsEmpty: string;
  };
  billing: {
    title: string;
    currentPlan: string;
    status: string;
    renewalDate: string;
    manageStripe: string;
    noCustomer: string;
    cancel: string;
    resume: string;
    portalUnavailable: string;
    upgradeOptions: string;
  };
  language: {
    title: string;
    note: string;
  };
};

export type Messages = MessageTree;
