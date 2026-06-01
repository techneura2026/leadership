'use client';

import { create } from 'zustand';
import { UserDto, OrganisationDto } from '@leaderprism/shared';

interface AuthState {
  accessToken: string | null;
  user: UserDto | null;
  organisation: OrganisationDto | null;
  isHydrated: boolean;

  setAuth: (token: string, user: UserDto, organisation: OrganisationDto) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  organisation: null,
  isHydrated: false,

  setAuth: (accessToken, user, organisation) =>
    set({ accessToken, user, organisation }),

  setAccessToken: (accessToken) => set({ accessToken }),

  clearAuth: () => set({ accessToken: null, user: null, organisation: null }),

  setHydrated: () => set({ isHydrated: true }),
}));
