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
    createSampleJob: string;
    optional: string;
    language: string;
  };
  onboarding: {
    progress: string;
    skipEntire: string;
    loading: string;
    calendarLater: string;
    inviteFailed: string;
    sampleJobName: string;
    sampleCustomer: string;
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
};

export type Messages = MessageTree;
