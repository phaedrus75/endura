/**
 * Bridge so push notification handlers can refresh the feedback unread badge.
 * Opening a specific thread uses navigation params (`openFeedbackThreadId` on
 * the Home tab) — see pushNotifications + HomeScreen.
 */
export const feedbackNavigation = {
  refreshFeedbackUnread: null as (() => void) | null,
};
