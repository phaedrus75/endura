import * as SecureStore from 'expo-secure-store';

// Use local development server
export const API_URL = 'https://web-production-34028.up.railway.app';

// Debug: Log API URL on startup
console.log('🔗 API URL:', API_URL);

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

export interface Animal {
  id: number;
  name: string;
  species: string;
  rarity: string;
  conservation_status: string | null;
  description: string | null;
  image_url: string | null;
  coins_to_hatch: number;
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
  likes_count: number;
  created_at: string;
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
  weekly_study_minutes: number;
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
  console.log('🌐 Fetching:', url);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      redirect: 'follow',
    });
    
    console.log('✅ Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      
      // If unauthorized, clear the token so user can re-login
      if (response.status === 401) {
        console.log('🔒 Unauthorized - clearing token');
        await SecureStore.deleteItemAsync('authToken');
      }
      
      throw new Error(error.detail || 'An error occurred');
    }
    
    return response.json();
  } catch (error: any) {
    console.error('❌ Network error:', error.message);
    console.error('📍 URL was:', url);
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
  completeSession: (duration_minutes: number, task_id?: number) =>
    apiFetch<StudySession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes, task_id }),
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
  
  createTip: (content: string, category = 'general') =>
    apiFetch<StudyTip>('/tips', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    }),
};

// Social API
export const socialAPI = {
  sendFriendRequest: (email: string) =>
    apiFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friend_email: email }),
    }),
  
  acceptFriendRequest: (requestId: number) =>
    apiFetch(`/friends/accept/${requestId}`, { method: 'POST' }),
  
  getFriends: () => apiFetch<Friend[]>('/friends'),
  
  getLeaderboard: () => apiFetch<LeaderboardEntry[]>('/leaderboard'),
};

// Stats API
export const statsAPI = {
  getStats: () => apiFetch<UserStats>('/stats'),
};

export const setApiUrl = (url: string) => {
  // This would be used for dynamic API URL configuration
  console.log('API URL set to:', url);
};
