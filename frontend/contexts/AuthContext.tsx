import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, User } from '../services/api';

const PROFILE_PIC_PREFIX = 'user_profile_picture_';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  profilePic: string | null;
  setProfilePic: (uri: string | null) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profilePicState, setProfilePicState] = useState<string | null>(null);

  const profilePicKey = (userId: number) => `${PROFILE_PIC_PREFIX}${userId}`;

  const loadProfilePicForUser = async (userData: User) => {
    try {
      if (userData.profile_pic_url) {
        setProfilePicState(userData.profile_pic_url);
        await AsyncStorage.setItem(profilePicKey(userData.id), userData.profile_pic_url);
        return;
      }
      const localUri = await AsyncStorage.getItem(profilePicKey(userData.id));
      if (localUri) {
        setProfilePicState(localUri);
        authAPI.uploadProfilePic(localUri).then(res => {
          setProfilePicState(res.profile_pic_url);
          AsyncStorage.setItem(profilePicKey(userData.id), res.profile_pic_url);
        }).catch(() => {});
      } else {
        setProfilePicState(null);
      }
    } catch {
      setProfilePicState(null);
    }
  };

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        const userData = await authAPI.getMe();
        setUser(userData);
        await loadProfilePicForUser(userData);
      }
    } catch (error) {
      if (__DEV__) console.log('Auth check failed:', error);
      // Preserve the token on transient errors (no network, 500s, timeouts).
      // apiFetch already deletes it on a real 401, so if we got here and the
      // token is still in SecureStore, it means the failure was NOT auth-related
      // and the user should be able to retry without re-logging in.
      setUser(null);
      setProfilePicState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleSetProfilePic = async (uri: string | null) => {
    setProfilePicState(uri);
    if (!user) return;
    if (uri) {
      await AsyncStorage.setItem(profilePicKey(user.id), uri);
      try {
        const res = await authAPI.uploadProfilePic(uri);
        setProfilePicState(res.profile_pic_url);
        await AsyncStorage.setItem(profilePicKey(user.id), res.profile_pic_url);
      } catch (e) {
        if (__DEV__) console.log('Failed to upload profile pic to server:', e);
      }
    } else {
      await AsyncStorage.removeItem(profilePicKey(user.id));
      try { await authAPI.deleteProfilePic(); } catch {}
    }
  };

  const login = async (email: string, password: string) => {
    await authAPI.login(email, password);
    const userData = await authAPI.getMe();
    setUser(userData);
    await loadProfilePicForUser(userData);
  };

  const register = async (email: string, password: string) => {
    await authAPI.register(email, password);
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
    setProfilePicState(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
      await loadProfilePicForUser(userData);
    } catch (error) {
      if (__DEV__) console.log('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        profilePic: profilePicState,
        setProfilePic: handleSetProfilePic,
        login,
        register,
        logout,
        refreshUser,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
