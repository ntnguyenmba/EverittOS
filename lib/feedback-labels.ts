/** Standard success labels for action feedback toasts. */
export const FEEDBACK = {
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
  loading: 'Working…'
} as const;

export type FeedbackLabelKey = keyof typeof FEEDBACK;
