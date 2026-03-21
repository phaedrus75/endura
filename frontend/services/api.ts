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
  user_liked: boolean;
}

export interface Friend {
  id: number;
  username: string | null;
  email: string;
  total_study_minutes: number;
  current_streak: number;
  animals_count: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string | null;
  total_study_minutes: number;
  current_streak: number;
  animals_count: number;
  total_donated: number;
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
}

export interface StudySessionWithHatchAndBadges extends StudySessionWithHatch {
  new_badges?: BadgeInfo[];
}

// ============ Social Types ============

export interface PactDayProgress {
  date: string;
  minutes_studied: number;
  completed: boolean;
}

export interface StudyPact {
  id: number;
  creator_username: string | null;
  buddy_username: string | null;
  creator_id: number;
  buddy_id: number;
  daily_minutes: number;
  duration_days: number;
  wager_amount: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  creator_progress: PactDayProgress[];
  buddy_progress: PactDayProgress[];
}

export interface StudyGroupMember {
  user_id: number;
  username: string | null;
  role: string;
  minutes_contributed: number;
}

export interface StudyGroup {
  id: number;
  name: string;
  creator_id: number;
  goal_minutes: number;
  goal_deadline: string | null;
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

// Helper function for API calls
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await SecureStore.getItemAsync('authToken');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      redirect: 'follow',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      
      if (response.status === 401) {
        await SecureStore.deleteItemAsync('authToken');
      }
      
      const detail = Array.isArray(error.detail)
        ? error.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ')
        : error.detail || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    
    return response.json();
  } catch (error: any) {
    if (__DEV__) console.error('API error:', endpoint, error.message);
    throw error;
  }
}

// Auth API
export const authAPI = {
  register: async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync('authToken', data.access_token);
    return data;
  },
  
  login: async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync('authToken', data.access_token);
    return data;
  },
  
  logout: async () => {
    await SecureStore.deleteItemAsync('authToken');
  },
  
  getMe: () => apiFetch<User>('/auth/me'),
  
  setUsername: (username: string) =>
    apiFetch('/user/username', {
      method: 'POST',
      body: JSON.stringify(username),
    }),
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
  completeSession: (duration_minutes: number, task_id?: number, animal_name?: string, subject?: string) =>
    apiFetch<StudySessionWithHatchAndBadges>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes, task_id, animal_name, subject }),
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
  getPendingRequests: () => apiFetch<{ id: number; user_id: number; username: string | null; email: string }[]>('/friends/pending'),

  getLeaderboard: () => apiFetch<LeaderboardEntry[]>('/leaderboard'),
};

// Stats API
export const statsAPI = {
  getStats: () => apiFetch<UserStats>('/stats'),
};

// Shop API
export const shopAPI = {
  spendCoins: (amount: number) =>
    apiFetch<{ current_coins: number; spent: number }>('/shop/spend', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

// Study Pact API
export const pactsAPI = {
  create: (buddyUsername: string, dailyMinutes: number, durationDays: number, wagerAmount: number) =>
    apiFetch<{ id: number; status: string }>('/pacts', {
      method: 'POST',
      body: JSON.stringify({ buddy_username: buddyUsername, daily_minutes: dailyMinutes, duration_days: durationDays, wager_amount: wagerAmount }),
    }),
  accept: (pactId: number) =>
    apiFetch<{ id: number; status: string }>(`/pacts/${pactId}/accept`, { method: 'POST' }),
  getAll: () => apiFetch<StudyPact[]>('/pacts'),
};

// Study Group API
export const groupsAPI = {
  create: (name: string, goalMinutes: number, goalDeadline?: string) =>
    apiFetch<{ id: number; name: string }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, goal_minutes: goalMinutes, goal_deadline: goalDeadline }),
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

export const setApiUrl = (url: string) => {
  // This would be used for dynamic API URL configuration
  console.log('API URL set to:', url);
};
