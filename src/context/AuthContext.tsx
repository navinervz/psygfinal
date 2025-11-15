import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api-client';
import {
  applyLogin,
  clearAuthStorage,
  getAccessToken,
  hardLogout,
  refreshAccessToken,
} from '../lib/auth';
import { sanitizeInput } from '../utils/security';
import { useNotificationContext } from './NotificationContext';

export interface User {
  id: string;
  email: string | null;
  fullName: string;
  walletBalanceRial: number;
  walletBalanceCrypto: number;
  walletAddress?: string | null;
  authType: 'EMAIL' | 'WEB3';
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithWallet: (address: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: { fullName?: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  topUpWallet: (amount: number, method: 'rial' | 'crypto') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface ApiUser {
  id: string;
  email?: string | null;
  fullName?: string | null;
  full_name?: string | null;
  walletBalanceRial?: string | number | null;
  walletBalanceCrypto?: string | number | null;
  walletAddress?: string | null;
  authType?: string;
  auth_type?: string;
  isAdmin?: boolean;
}

const parseNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapUser = (raw: ApiUser): User => ({
  id: raw.id,
  email: raw.email ?? null,
  fullName: raw.fullName ?? raw.full_name ?? '',
  walletBalanceRial: parseNumber(raw.walletBalanceRial),
  walletBalanceCrypto: parseNumber(raw.walletBalanceCrypto),
  walletAddress: raw.walletAddress ?? null,
  authType: (raw.authType ?? raw.auth_type ?? 'EMAIL') === 'WEB3' ? 'WEB3' : 'EMAIL',
  isAdmin: raw.isAdmin,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useNotificationContext();

  const loadProfile = useCallback(async () => {
    const { data } = await api.get('/auth/profile');
    if (data?.success && data?.user) {
      setUser(mapUser(data.user as ApiUser));
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      let token = getAccessToken();
      if (!token) {
        token = await refreshAccessToken(api);
      }
      if (!token) {
        setUser(null);
        return;
      }
      await loadProfile();
    } catch (error) {
      clearAuthStorage(api);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      applyLogin({ accessToken: data?.accessToken }, api);
      if (data?.user) {
        setUser(mapUser(data.user as ApiUser));
      }
      showSuccess('Welcome back!', 'You are signed in.');
    } catch (error: any) {
      console.error('Sign in failed', error);
      showError('Could not sign in', error?.response?.data?.error || 'Please check your credentials.');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, showSuccess]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const cleanName = sanitizeInput(fullName).trim();
      const { data } = await api.post('/auth/register', { email, password, fullName: cleanName });
      applyLogin({ accessToken: data?.accessToken }, api);
      if (data?.user) {
        setUser(mapUser(data.user as ApiUser));
      }
      showSuccess('Account created', 'Registration completed successfully.');
    } catch (error: any) {
      console.error('Sign up failed', error);
      showError('Could not sign up', error?.response?.data?.error || 'Please try again later.');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, showSuccess]);

  const signInWithWallet = useCallback(async (address: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/web3-login', { walletAddress: address });
      applyLogin({ accessToken: data?.accessToken }, api);
      if (data?.user) {
        setUser(mapUser(data.user as ApiUser));
      }
      showSuccess('Wallet connected', 'You are signed in with your wallet.');
    } catch (error: any) {
      console.error('Wallet sign-in failed', error);
      showError('Could not sign in with wallet', error?.response?.data?.error || 'Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError, showSuccess]);

  const signOut = useCallback(async () => {
    await hardLogout(undefined, api);
    setUser(null);
    setLoading(false);
  }, []);

  const updateProfile = useCallback(async (data: { fullName?: string }) => {
    try {
      const payload: Record<string, unknown> = {};
      if (data.fullName) {
        payload.fullName = sanitizeInput(data.fullName).trim();
      }
      const response = await api.put('/auth/profile', payload);
      if (response.data?.success && response.data?.user) {
        setUser(mapUser(response.data.user as ApiUser));
        showSuccess('Profile updated', 'Your profile information was saved.');
      }
    } catch (error: any) {
      console.error('Profile update failed', error);
      showError('Could not update profile', error?.response?.data?.error || 'Please try again later.');
      throw error;
    }
  }, [showError, showSuccess]);

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    loading,
    signIn,
    signUp,
    signInWithWallet,
    signOut,
    updateProfile,
    refreshProfile: async () => {
      await loadProfile();
    },
topUpWallet: async (amount: number, method: 'rial' | 'crypto') => {
    try {
      const response = await api.post('/wallet/topup', { amount, method });
      if (response.data?.success) {
        await loadProfile();
        showSuccess('موجودی به‌روز شد', 'شارژ کیف پول با موفقیت انجام شد.');
      }
    } catch (error: any) {
      console.error('Wallet topup failed', error);
      showError('خرابی در شارژ', error?.response?.data?.error || 'لطفاً دوباره تلاش کنید.');
      throw error;
    }
  },  }), [user, loading, signIn, signUp, signInWithWallet, signOut, updateProfile, loadProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

