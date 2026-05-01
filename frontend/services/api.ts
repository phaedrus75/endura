import * as SecureStore from 'expo-secure-store';

// Use local development server
export const API_URL = 'https://web-production-34028.up.railway.app';


// Types
export interface User {
  id: number;
  email: string;
  username: string | null;
  total_coins: number;
  current_coins: number;
  current_streak: number;
  longest_streak: number;
  total_study_minutes: number;
  total_sessions: number;
  created_at: string;
  profile_pic_url: string | null;
  school: string | null;
  city: string | null;
  country: string | null;
  is_admin: boolean;
  use_test_timer: boolean;
  notification_enabled?: boolean;
  notif_badges_enabled?: boolean;
  notif_friends_enabled?: boolean;
  notif_reminders_enabled?: boolean;
  notif_marketing_enabled?: boolean;
  /** Sticky onboarding A/B arm (v1|v2), set once from device after login */
  onboarding_ab_variant?: string | null;
}

export interface NotificationPrefs {
  notification_enabled: boolean;
  notif_badges_enabled: boolean;
  notif_friends_enabled: boolean;
  notif_reminders_enabled: boolean;
  notif_marketing_enabled: boolean;
  study_reminder_hour: number | null;
  study_reminder_minute: number | null;
  has_push_token: boolean;
}

export interface SchoolSearchResult {
  name: string;
  city: string | null;
  region: string | null;
  country: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  estimated_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  due_date: string | null;
  priority: number;
}

export interface StudySession {
  id: number;
  task_id: number | null;
  duration_minutes: number;
  coins_earned: number;
  started_at: string;
  completed_at: string | null;
}

export interface StudySessionWithHatch {
  session: StudySession;
  hatched_animal: Animal | null;
}

export interface Animal {
  id: number;
  name: string;
  species: string;
  rarity: string;
  conservation_status: string | null;
  description: string | null;
  image_url: string | null;
}

export interface UserAnimal {
  id: number;
  animal: Animal;
  nickname: string | null;
  hatched_at: string;
  shared_with_username?: string | null;
}

export interface Egg {
  coins_deposited: number;
  coins_required: number;
  progress_percent: number;
  animal_hint: string | null;
}

export interface HatchResult {
  success: boolean;
  animal: Animal | null;
  message: string;
}

export interface StudyTip {
  id: number;
  content: string;
  category: string;
  animal_name?: string;
  likes_count: number;
  dislikes_count: number;
  created_at: string;
  user_liked: boolean;
  user_disliked: boolean;
  user_saved?: boolean;
}

export interface Friend {
  id: number;
  username: string | null;
  email?: string | null;
  total_study_minutes: number;
  current_streak: number;
  animals_count: number;
  profile_pic_url: string | null;
  friends_since: string | null;
}

export interface FriendProfile {
  id: number;
  username: string | null;
  email?: string | null;
  total_study_minutes: number;
  current_streak: number;
  longest_streak: number;
  total_sessions: number;
  animals_count: number;
  profile_pic_url: string | null;
  friends_since: string | null;
  member_since: string | null;
  total_coins: number;
  school: string | null;
  city: string | null;
  country: string | null;
  subjects: string[];
}

export interface FriendSuggestion {
  id: number;
  username: string;
  total_study_minutes: number;
  current_streak: number;
  profile_pic_url: string | null;
  school: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string | null;
  total_study_minutes: number;
  current_streak: number;
  animals_count: number;
  total_donated: number;
  profile_pic_url: string | null;
}

export interface DonationLeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  total_donated: number;
  donation_count: number;
  is_current_user: boolean;
}

export interface BadgeInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  tier: string;
}

export interface BadgeResponse extends BadgeInfo {
  earned: boolean;
  earned_at?: string;
  requirement?: string;
}

export interface StudySessionWithHatchAndBadges extends StudySessionWithHatch {
  new_badges?: BadgeInfo[];
}

// ============ Social Types ============

export interface StudyGroupMember {
  user_id: number;
  username: string | null;
  role: string;
  minutes_contributed: number;
  profile_pic_url: string | null;
}

export interface StudyGroup {
  id: number;
  name: string;
  creator_id: number;
  goal_minutes: number;
  goal_deadline: string | null;
  subject: string | null;
  subject_id: number | null;
  created_at: string;
  members: StudyGroupMember[];
  total_minutes: number;
  goal_met: boolean;
}

export interface GroupMessage {
  id: number;
  user_id: number;
  username: string | null;
  content: string;
  created_at: string;
  profile_pic_url: string | null;
}

export interface FeedEvent {
  id: number;
  user_id: number;
  username: string | null;
  event_type: string;
  description: string;
  created_at: string;
  reactions: { user_id: number; reaction: string }[];
}

export interface ResearchConsentState {
  consent: boolean | null;
  consent_at: string | null;
  copy?: { title?: string; body?: string };
}

export interface ResearchSurveyQuestion {
  id: number;
  question_key: string;
  prompt: string;
  question_type: 'likert' | 'single_choice' | 'multi_choice' | 'free_text' | 'number' | string;
  options?: string[] | null;
  is_required: boolean;
  sort_order: number;
}

export interface ResearchSurveyPayload {
  id: number;
  survey_key: string;
  title: string;
  description?: string | null;
  intro_text?: string | null;
  thank_you_text?: string | null;
  trigger_type: string;
  questions: ResearchSurveyQuestion[];
}

export interface ResearchNextSurvey {
  needs_consent: boolean;
  assignment: { id: number; status: string; trigger_reason?: string | null } | null;
  survey: ResearchSurveyPayload | null;
  copy?: { title?: string; body?: string };
}

export interface UserStats {
  total_coins: number;
  current_coins: number;
  total_study_minutes: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  animals_hatched: number;
  tasks_completed: number;
  weekly_study_minutes: number[];
  monthly_study_minutes: number[];
  study_minutes_by_subject: { [key: string]: number };
}

export interface Subject {
  id: number;
  name: string;
  display_name: string;
  is_default: boolean;
}

// Helper function for API calls
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await SecureStore.getItemAsync('authToken');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      redirect: 'error',
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        await SecureStore.deleteItemAsync('authToken');
      }

      if (response.status >= 500) {
        throw new Error('Something went wrong. Please try again later.');
      }

      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      const detail = Array.isArray(error.detail)
        ? error.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ')
        : error.detail || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    
    return response.json();
  } catch (error: any) {
    if (__DEV__) console.warn('API error:', endpoint, error.message);
    throw error;
  }
}

// Auth API
export const authAPI = {
  register: async (email: string, password: string) => {
    const data = await apiFetch<{ message: string; needs_verification: boolean }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return data;
  },

  verifyEmail: async (email: string, code: string) => {
    const data = await apiFetch<{ access_token: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    await SecureStore.setItemAsync('authToken', data.access_token);
    return data;
  },

  resendVerification: (email: string) =>
    apiFetch<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  
  login: async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync('authToken', data.access_token);
    return data;
  },

  loginWithApple: async (body: { identity_token: string; email?: string | null }) => {
    const data = await apiFetch<{ access_token: string }>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await SecureStore.setItemAsync('authToken', data.access_token);
    return data;
  },

  loginWithGoogle: async (body: { id_token: string }) => {
    const data = await apiFetch<{ access_token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await SecureStore.setItemAsync('authToken', data.access_token);
    return data;
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Best-effort — clear local token even if server call fails
    }
    await SecureStore.deleteItemAsync('authToken');
  },

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: async (email: string, code: string, new_password: string) => {
    const data = await apiFetch<{ message: string; access_token: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password }),
    });
    if (data.access_token) {
      await SecureStore.setItemAsync('authToken', data.access_token);
    }
    return data;
  },

  getMe: () => apiFetch<User>('/auth/me'),

  /** Persist sticky v1/v2 once server-side for admin funnel reporting */
  syncOnboardingAbVariant: (variant: 'v1' | 'v2') =>
    apiFetch<User>('/auth/onboarding-ab-variant', {
      method: 'POST',
      body: JSON.stringify({ variant }),
    }),

  setUsername: (username: string) =>
    apiFetch(`/user/username?username=${encodeURIComponent(username)}`, {
      method: 'POST',
    }),

  completeOnboarding: () =>
    apiFetch<{ ok: boolean; onboarding_completed_at: string | null }>('/user/onboarding/complete', {
      method: 'POST',
    }),

  updateProfile: (data: { school?: string; city?: string; country?: string }) =>
    apiFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateSettings: (data: { use_test_timer?: boolean }) =>
    apiFetch<User>('/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  searchSchools: (q: string) =>
    apiFetch<SchoolSearchResult[]>(`/schools/search?q=${encodeURIComponent(q)}`),

  uploadProfilePic: async (uri: string): Promise<{ profile_pic_url: string }> => {
    const token = await SecureStore.getItemAsync('authToken');
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type } as any);
    const response = await fetch(`${API_URL}/auth/profile-pic`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (response.status === 401) {
      await SecureStore.deleteItemAsync('authToken');
    }
    if (!response.ok) throw new Error('Failed to upload profile picture');
    return response.json();
  },

  deleteProfilePic: () =>
    apiFetch<{ message: string }>('/auth/profile-pic', { method: 'DELETE' }),

  deleteAccount: () =>
    apiFetch<{ message: string }>('/auth/account', { method: 'DELETE' }),
};

// Push notifications API
export const pushAPI = {
  registerToken: (
    token: string,
    platform: 'ios' | 'android',
    meta?: { app_version?: string; app_build?: string }
  ) =>
    apiFetch<{
      ok: boolean;
      push_token_updated_at: string;
      platform: string;
      app_version?: string | null;
      app_build?: string | null;
    }>(
      '/users/me/push-token',
      {
        method: 'PUT',
        body: JSON.stringify({
          token,
          platform,
          ...(meta?.app_version ? { app_version: meta.app_version } : {}),
          ...(meta?.app_build ? { app_build: meta.app_build } : {}),
        }),
      }
    ),

  removeToken: () =>
    apiFetch<{ ok: boolean }>('/users/me/push-token', { method: 'DELETE' }),

  getPrefs: () =>
    apiFetch<NotificationPrefs>('/users/me/notification-prefs'),

  updatePrefs: (prefs: Partial<NotificationPrefs>) =>
    apiFetch<NotificationPrefs>('/users/me/notification-prefs', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  /**
   * Report that a locally-scheduled notification fired on this device, so the
   * admin dashboard can count it alongside server-sent pushes. Called twice per
   * notification: once on delivery (`opened: false`), once on tap (`opened: true`).
   * Backend dedupes by `identifier`.
   */
  logLocalFired: (payload: {
    template_key: string;
    identifier: string;
    title?: string;
    body?: string;
    category?: string;
    opened?: boolean;
  }) =>
    apiFetch<{ ok: boolean; id: number; updated: boolean }>(
      '/push/local-fired',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
};

// User feedback API — submits to the existing POST /feedback endpoint that
// also powers the admin dashboard's Feedback / feature-request views.
export type FeedbackType = 'bug' | 'feature' | 'question' | 'praise';

export interface FeedbackSubmission {
  feedback_type: FeedbackType;
  message: string;
  title?: string;
  email?: string;
  app_version?: string;
  os?: string;
  device_model?: string;
  screen_context?: string;
  attachment_urls?: string[];
}

/** One row in GET /me/feedback — a thread the user started while signed in. */
export interface FeedbackInboxItem {
  id: number;
  feedback_type: string;
  title: string | null;
  message_preview: string;
  status: string;
  last_message_at: string;
  created_at: string;
  unread_count: number;
  /** True when at least one admin message exists — tap row to read it. */
  has_team_reply?: boolean;
}

export interface FeedbackThreadMessage {
  id: number;
  sender: 'admin' | 'user' | string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface FeedbackThreadPayload {
  feedback: {
    id: number;
    feedback_type: string;
    title: string | null;
    message: string;
    status: string;
    created_at: string;
    updated_at: string;
    attachment_urls: string[];
  };
  messages: FeedbackThreadMessage[];
}

export const feedbackAPI = {
  submit: (payload: FeedbackSubmission) =>
    apiFetch<{ id: number; message: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  list: () => apiFetch<{ items: FeedbackInboxItem[] }>('/me/feedback'),

  thread: (id: number) => apiFetch<FeedbackThreadPayload>(`/me/feedback/${id}`),

  markRead: (id: number) =>
    apiFetch<{ ok: boolean; marked: number }>(`/me/feedback/${id}/read`, { method: 'POST' }),

  unreadCount: () => apiFetch<{ unread_count: number }>('/me/feedback/unread-count'),

  /**
   * Upload a single image to be attached to a feedback submission. Returns
   * the public URL — the caller should collect these and pass them as
   * `attachment_urls` to `submit()`. Mirrors `uploadProfilePic` mechanics.
   */
  uploadAttachment: async (uri: string): Promise<{ url: string }> => {
    const token = await SecureStore.getItemAsync('authToken');
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'feedback.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type } as any);
    const response = await fetch(`${API_URL}/feedback/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (response.status === 401) {
      await SecureStore.deleteItemAsync('authToken');
      throw new Error('Please sign in to attach images.');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || 'Failed to upload image');
    }
    return response.json();
  },
};

// Tasks API
export const tasksAPI = {
  getTasks: (includeCompleted = false) =>
    apiFetch<Task[]>(`/tasks?include_completed=${includeCompleted}`),
  
  createTask: (task: {
    title: string;
    description?: string;
    estimated_minutes?: number;
    due_date?: string;
    priority?: number;
  }) =>
    apiFetch<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),
  
  updateTask: (id: number, updates: Partial<Task>) =>
    apiFetch<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  
  deleteTask: (id: number) =>
    apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
};

// Study Sessions API
export const sessionsAPI = {
  completeSession: (duration_minutes: number, task_id?: number, animal_name?: string, subject_id?: number) =>
    apiFetch<StudySessionWithHatchAndBadges>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes, task_id, animal_name, subject_id }),
    }),
  
  getSessions: (limit = 50) =>
    apiFetch<StudySession[]>(`/sessions?limit=${limit}`),
};

// Egg & Animals API
export const animalsAPI = {
  getEgg: () => apiFetch<Egg>('/egg'),
  
  hatchEgg: () =>
    apiFetch<HatchResult>('/egg/hatch', { method: 'POST' }),
  
  getAllAnimals: () => apiFetch<Animal[]>('/animals'),
  
  getMyAnimals: () => apiFetch<UserAnimal[]>('/my-animals'),
  
  nameAnimal: (animalId: number, nickname: string) =>
    apiFetch(`/my-animals/${animalId}/name?nickname=${encodeURIComponent(nickname)}`, {
      method: 'PUT',
    }),
};

// Study Tips API
export const tipsAPI = {
  getTips: (limit = 10) => apiFetch<StudyTip[]>(`/tips?limit=${limit}`),

  markViewed: (tipId: number, liked = false) =>
    apiFetch(`/tips/${tipId}/view?liked=${liked}`, { method: 'POST' }),

  voteTip: (tipId: number, vote: 'up' | 'down') =>
    apiFetch<{ likes_count: number; dislikes_count: number; user_liked: boolean; user_disliked: boolean }>(
      `/tips/${tipId}/vote?vote=${vote}`,
      { method: 'POST' },
    ),

  createTip: (content: string, category = 'general') =>
    apiFetch<StudyTip>('/tips', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    }),

  sendToFriend: (friendId: number, tipContent: string, animalName: string) =>
    apiFetch<{ message: string }>('/tips/send', {
      method: 'POST',
      body: JSON.stringify({ friend_id: friendId, tip_content: tipContent, animal_name: animalName }),
    }),

  getSavedTips: () => apiFetch<StudyTip[]>('/tips/saved'),

  saveTip: (tipId: number) =>
    apiFetch<{ saved: boolean; tip_id: number }>(`/tips/${tipId}/save`, { method: 'POST' }),

  unsaveTip: (tipId: number) =>
    apiFetch<{ saved: boolean; tip_id: number }>(`/tips/${tipId}/unsave`, { method: 'POST' }),

  syncSaves: (tipIds: number[]) =>
    apiFetch<{ created: number; updated: number; skipped: number }>('/tips/sync-saves', {
      method: 'POST',
      body: JSON.stringify({ tip_ids: tipIds }),
    }),
};

// Social API
export const socialAPI = {
  sendFriendRequest: (username: string) =>
    apiFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friend_username: username }),
    }),
  
  acceptFriendRequest: (requestId: number) =>
    apiFetch(`/friends/accept/${requestId}`, { method: 'POST' }),
  
  getFriends: () => apiFetch<Friend[]>('/friends'),
  getPendingRequests: () => apiFetch<{ id: number; user_id: number; username: string | null; profile_pic_url: string | null }[]>('/friends/pending'),

  removeFriend: (friendId: number) =>
    apiFetch(`/friends/${friendId}`, { method: 'DELETE' }),

  getFriendProfile: (friendId: number) =>
    apiFetch<FriendProfile>(`/friends/${friendId}/profile`),

  getFriendSubjects: (friendId: number) =>
    apiFetch<{ subjects: string[] }>(`/friends/${friendId}/subjects`),

  getLeaderboard: (period: string = 'all_time') => apiFetch<LeaderboardEntry[]>(`/leaderboard?period=${period}`),
  getGlobalLeaderboard: (period: string = 'all_time') => apiFetch<LeaderboardEntry[]>(`/leaderboard/global?period=${period}`),
  getSchoolLeaderboard: (period: string = 'all_time') => apiFetch<LeaderboardEntry[]>(`/leaderboard/school?period=${period}`),

  getFriendSuggestions: () => apiFetch<FriendSuggestion[]>('/friends/suggestions'),
};

// Stats API
export const statsAPI = {
  getStats: () => apiFetch<UserStats>('/stats'),
};

// Subjects API
export const subjectsAPI = {
  getAll: () => apiFetch<Subject[]>('/subjects'),
  getMySubjects: () => apiFetch<Subject[]>('/subjects/me'),
  addSubject: (subjectId: number) =>
    apiFetch<{ message: string }>('/subjects/me', {
      method: 'POST',
      body: JSON.stringify({ subject_id: subjectId }),
    }),
  removeSubject: (subjectId: number) =>
    apiFetch<{ message: string }>(`/subjects/me/${subjectId}`, { method: 'DELETE' }),
  createCustom: (displayName: string) =>
    apiFetch<Subject>('/subjects', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName }),
    }),
  getShared: (userIds: number[]) =>
    apiFetch<Subject[]>(`/subjects/shared?user_ids=${userIds.join(',')}`),
  search: (q: string) =>
    apiFetch<Subject[]>(`/subjects/search?q=${encodeURIComponent(q)}`),
};

// Shop API
export const shopAPI = {
  spendCoins: (amount: number) =>
    apiFetch<{ current_coins: number; spent: number }>('/shop/spend', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  getPurchases: () =>
    apiFetch<Record<string, number>>('/shop/purchases'),
  recordPurchase: (item_key: string, quantity: number = 1) =>
    apiFetch<{ item_key: string; quantity: number }>('/shop/purchases', {
      method: 'POST',
      body: JSON.stringify({ item_key, quantity }),
    }),
  getAssignments: () =>
    apiFetch<Array<{ itemId: string; x: number; y: number; page: number }>>('/shop/assignments'),
  saveAssignments: (assignments: Array<{ itemId: string; x: number; y: number; page: number }>) =>
    apiFetch<{ saved: number }>('/shop/assignments', {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
};

// Study Group API
export const groupsAPI = {
  create: (name: string, goalMinutes: number, goalDeadline?: string, subject_id?: number) =>
    apiFetch<{ id: number; name: string }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, goal_minutes: goalMinutes, goal_deadline: goalDeadline, subject_id }),
    }),
  join: (groupId: number) =>
    apiFetch('/groups/' + groupId + '/join', { method: 'POST' }),
  leave: (groupId: number) =>
    apiFetch('/groups/' + groupId + '/leave', { method: 'POST' }),
  getAll: () => apiFetch<StudyGroup[]>('/groups'),
  sendMessage: (groupId: number, content: string) =>
    apiFetch<GroupMessage>(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  getMessages: (groupId: number) =>
    apiFetch<GroupMessage[]>(`/groups/${groupId}/messages`),
  invite: (groupId: number, opts: { username?: string; user_id?: number }) =>
    apiFetch<{ message: string }>(`/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),
  removeMember: (groupId: number, userId: number) =>
    apiFetch<{ message: string }>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  updateGoal: (groupId: number, goalMinutes: number) =>
    apiFetch<{ message: string; goal_minutes: number }>(`/groups/${groupId}/goal`, {
      method: 'PUT',
      body: JSON.stringify({ goal_minutes: goalMinutes }),
    }),
  updateGroup: (groupId: number, data: { name?: string; subject_id?: number | null; goal_minutes?: number }) =>
    apiFetch<{ message: string; name: string; subject: string | null; subject_id: number | null; goal_minutes: number }>(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Activity Feed API
export const feedAPI = {
  getFeed: () => apiFetch<FeedEvent[]>('/feed'),
  react: (eventId: number, reaction: string) =>
    apiFetch(`/feed/${eventId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    }),
  getNewReactions: () =>
    apiFetch<{
      id: number;
      sender_username: string;
      reaction: string;
      event_description: string;
      created_at: string;
    }[]>('/feed/reactions/new'),
};

export const researchAPI = {
  getConsent: () => apiFetch<ResearchConsentState>('/research/consent'),
  setConsent: (consent: boolean) =>
    apiFetch<{ ok: boolean; consent: boolean }>('/research/consent', {
      method: 'POST',
      body: JSON.stringify({ consent }),
    }),
  getNextSurvey: () => apiFetch<ResearchNextSurvey>('/research/surveys/next'),
  startSurvey: (assignmentId: number) =>
    apiFetch<{ ok: boolean; status: string }>(`/research/surveys/${assignmentId}/start`, { method: 'POST' }),
  submitSurvey: (assignmentId: number, answers: Array<{ question_id: number; answer: any }>) =>
    apiFetch<{ ok: boolean; status: string }>(`/research/surveys/${assignmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  snoozeSurvey: (assignmentId: number, days = 14) =>
    apiFetch<{ ok: boolean; status: string; snoozed_until: string }>(`/research/surveys/${assignmentId}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    }),
  dismissSurvey: (assignmentId: number) =>
    apiFetch<{ ok: boolean; status: string }>(`/research/surveys/${assignmentId}/dismiss`, { method: 'POST' }),
};

// Badges API
export const badgesAPI = {
  getBadges: () => apiFetch<BadgeResponse[]>('/badges'),
  checkBadges: () =>
    apiFetch<{ new_badges: BadgeInfo[] }>('/badges/check', { method: 'POST' }),
};

// Donations API
export const donationsAPI = {
  getUserStats: (userId: number) =>
    apiFetch<{ total_donated: number; donation_count: number; history: { amount: number; currency: string; nonprofit: string; date: string }[] }>(
      `/donations/user/${userId}`
    ),
  getLeaderboard: () =>
    apiFetch<DonationLeaderboardEntry[]>('/donations/leaderboard'),
  checkDonation: (partnerId: string) =>
    apiFetch<{ confirmed: boolean; amount?: number; nonprofit?: string }>(`/donations/check/${partnerId}`),
};

// Moderation API
export const moderationAPI = {
  reportContent: (reported_user_id: number, content_type: string, reason: string, content_id?: number, details?: string) =>
    apiFetch<{ message: string }>('/report', {
      method: 'POST',
      body: JSON.stringify({ reported_user_id, content_type, reason, content_id, details }),
    }),
  blockUser: (userId: number) =>
    apiFetch<{ message: string }>(`/block/${userId}`, { method: 'POST' }),
  unblockUser: (userId: number) =>
    apiFetch<{ message: string }>(`/block/${userId}`, { method: 'DELETE' }),
  getBlockedUsers: () =>
    apiFetch<Array<{ id: number; username: string; email: string }>>('/blocked-users'),
};

export const setApiUrl = (url: string) => {
  if (__DEV__) console.log('API URL set to:', url);
};
