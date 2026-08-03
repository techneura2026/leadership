import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

const BASE_URL =
  typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL ?? 'http://localhost:3001') + '/api/v1'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1');




export interface ParticipantActivity {
  month: string;
  participants: number;
}



export interface DashboardData {
  activeAssessments: number;
  totalParticipants: number;
  reportsGenerated: number;
  pendingResponses: number;
  assessmentsByType: Record<string, number>;
  assessmentsByStatus: Record<string, number>;
  recentAssessments: any[];
}

export const getDashboardData = async (): Promise<DashboardData> => {
  const response = await api.get('/analytics/dashboard');
  return response.data.data;
};


export interface ParticipantCompletion {
  rate: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}














export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token from store to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

// On 401: refresh token, retry original request once
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't retry the refresh endpoint itself, and don't hijack a failed login/register
    // attempt into a silent-refresh + hard redirect — that would wipe out the error message
    // the login form is about to show before the user ever sees it.
    if (
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/register')
    ) {
      if (original.url?.includes('/auth/refresh')) {
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ data: { accessToken: string } }>(
        `${BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken = data.data.accessToken;
      useAuthStore.getState().setAccessToken(newToken);
      processQueue(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);



export const getParticipantActivity = async (): Promise<ParticipantActivity[]> => {
  const { data } = await api.get('/analytics/activity/participants');
  return data.data;
};



export const getParticipantCompletion = async (): Promise<ParticipantCompletion> => {
  const { data } = await api.get('/analytics/completion/participants');
  return data.data;
};
