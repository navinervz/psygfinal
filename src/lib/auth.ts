import axios, { AxiosInstance } from 'axios';

type NavigateFn = (path: string, options?: any) => void;

const ACCESS_TOKEN_KEY = 'psyg_access_token_v1';
const LOGOUT_BROADCAST_KEY = 'psyg_logout';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let teardown: (() => void) | null = null;
let isLoggingOut = false;

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function persistAccessToken(token?: string) {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    if (token) storage.setItem(ACCESS_TOKEN_KEY, token);
    else storage.removeItem(ACCESS_TOKEN_KEY);
  } catch {}
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const token = storage.getItem(ACCESS_TOKEN_KEY);
    inMemoryAccessToken = token;
    return token;
  } catch {
    return null;
  }
}

export function setAuthToken(token?: string, ax: AxiosInstance = axios) {
  inMemoryAccessToken = token ?? null;
  persistAccessToken(token);
  if (token) {
    ax.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete ax.defaults.headers.common.Authorization;
  }
}

export function applyLogin(
  opts: { accessToken: string },
  ax: AxiosInstance = axios,
) {
  setAuthToken(opts.accessToken, ax);
}

export function clearAuthStorage(ax: AxiosInstance = axios) {
  setAuthToken(undefined, ax);
  const storage = getSessionStorage();
  storage?.removeItem('registered_users');
  storage?.removeItem('current_user');
  // Legacy localStorage cleanup for older builds
  try {
    localStorage.removeItem('registered_users');
    localStorage.removeItem('current_user');
  } catch {}
}

async function performRefresh(ax: AxiosInstance): Promise<string | null> {
  try {
    const { data } = await ax.post('/auth/refresh');
    const accessToken = data?.accessToken;
    if (accessToken) {
      setAuthToken(accessToken, ax);
      return accessToken;
    }
    clearAuthStorage(ax);
    return null;
  } catch (error) {
    clearAuthStorage(ax);
    return null;
  } finally {
    refreshPromise = null;
  }
}

export function refreshAccessToken(ax: AxiosInstance = axios): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh(ax);
  return refreshPromise;
}

async function disconnectAllWallets() {
  try {
    const { disconnect } = await import('@wagmi/core');
    if (typeof disconnect === 'function') {
      await disconnect();
    }
  } catch {}

  try {
    const eth: any = (window as any).ethereum;
    eth?.removeAllListeners?.('accountsChanged');
    eth?.removeAllListeners?.('chainChanged');
    eth?.removeAllListeners?.('connect');
    eth?.removeAllListeners?.('disconnect');
  } catch {}

  try {
    const { default: WalletConnectModal } = await import('@reown/appkit');
    const modal: any = new WalletConnectModal();
    await modal.disconnect?.();
    await modal.close?.();
  } catch {}

  try {
    const databases = [
      'WALLETCONNECT_V2_INDEXED_DB',
      'walletconnect',
      'wc@2:client',
    ];
    databases.forEach((name) => {
      try {
        (window as any).indexedDB?.deleteDatabase?.(name);
      } catch {}
    });
  } catch {}
}

export async function hardLogout(navigate?: NavigateFn, ax: AxiosInstance = axios) {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    await ax.post('/auth/logout').catch(() => undefined);
  } finally {
    clearAuthStorage(ax);
    await disconnectAllWallets();
    try { const storage = getSessionStorage(); storage?.setItem(LOGOUT_BROADCAST_KEY, String(Date.now())); } catch {}
    if (navigate) navigate('/auth', { replace: true });
    else if (typeof window !== 'undefined') {
      window.location.assign('/auth');
    }
    setTimeout(() => {
      isLoggingOut = false;
    }, 500);
  }
}

export function setupAxiosAuth(ax: AxiosInstance = axios, navigate?: NavigateFn) {
  ax.defaults.baseURL = API_BASE_URL;
  ax.defaults.withCredentials = true;

  const existingToken = getAccessToken();
  if (existingToken) {
    ax.defaults.headers.common.Authorization = `Bearer ${existingToken}`;
  }

  const responseInterceptor = ax.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { response, config } = error;
      if (!response || !config) {
        return Promise.reject(error);
      }

      const originalRequest = config as typeof config & { _retry?: boolean };

      if (response.status === 401 && !originalRequest._retry && !isLoggingOut) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken(ax);
        if (newToken) {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return ax(originalRequest);
        }
      }

      if (response.status === 401 && !isLoggingOut) {
        await hardLogout(navigate, ax);
      }

      return Promise.reject(error);
    }
  );

  const requestInterceptor = ax.interceptors.request.use((request) => {
    const token = getAccessToken();
    if (token && !request.headers?.Authorization) {
      request.headers = { ...(request.headers || {}), Authorization: `Bearer ${token}` };
    }
    return request;
  });

  const storageListener = (event: StorageEvent) => {
    if (event.key === LOGOUT_BROADCAST_KEY && !isLoggingOut) {
      hardLogout(navigate, ax);
    }
  };

  try { window.addEventListener('storage', storageListener); } catch {}

  teardown = () => {
    ax.interceptors.response.eject(responseInterceptor);
    ax.interceptors.request.eject(requestInterceptor);
    try { window.removeEventListener('storage', storageListener); } catch {}
  };

  return teardown;
}

if (typeof window !== 'undefined') {
  (window as any).psygLogout = () => hardLogout(undefined, axios);
}

