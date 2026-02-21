import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = 'phc_qlSNrffxYPTSRAxQy0gC7q7h4DmhMiScXYwriCiTOtr';
const POSTHOG_HOST = 'https://us.i.posthog.com';

export const posthogClient = new PostHog(POSTHOG_API_KEY, {
  host: POSTHOG_HOST,
  enableSessionReplay: false,
  flushAt: 20,
  flushInterval: 30000,
  debug: __DEV__,
});

export function identifyUser(userId: number, properties?: Record<string, any>) {
  posthogClient.identify(String(userId), properties);
}

export function resetUser() {
  posthogClient.reset();
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  posthogClient.capture(event, properties);
}

export const Analytics = {
  appOpened: () => trackEvent('app_opened'),
  sessionStarted: (minutes: number, subject?: string) =>
    trackEvent('session_started', { duration_minutes: minutes, subject }),
  sessionCompleted: (minutes: number, coinsEarned: number, subject?: string) =>
    trackEvent('session_completed', { duration_minutes: minutes, coins_earned: coinsEarned, subject }),
  sessionAbandoned: (minutesElapsed: number) =>
    trackEvent('session_abandoned', { minutes_elapsed: minutesElapsed }),
  eggHatched: (animalName: string, rarity: string) =>
    trackEvent('egg_hatched', { animal_name: animalName, rarity }),
  donationStarted: (amount: number) =>
    trackEvent('donation_started', { amount }),
  donationCompleted: (amount: number) =>
    trackEvent('donation_completed', { amount }),
  tipViewed: (tipId: number) =>
    trackEvent('tip_viewed', { tip_id: tipId }),
  tipSaved: (tipId: number) =>
    trackEvent('tip_saved', { tip_id: tipId }),
  tipSent: (tipId: number, targetType: 'friend' | 'group') =>
    trackEvent('tip_sent', { tip_id: tipId, target_type: targetType }),
  friendAdded: () => trackEvent('friend_added'),
  badgeEarned: (badgeId: string, badgeName: string) =>
    trackEvent('badge_earned', { badge_id: badgeId, badge_name: badgeName }),
  shopItemPurchased: (itemId: string, cost: number) =>
    trackEvent('shop_item_purchased', { item_id: itemId, cost }),
  sanctuaryViewed: () => trackEvent('sanctuary_viewed'),
  todoCreated: (subject?: string) =>
    trackEvent('todo_created', { subject }),
  todoCompleted: () => trackEvent('todo_completed'),
  screenViewed: (screenName: string) =>
    trackEvent('screen_viewed', { screen: screenName }),
};
