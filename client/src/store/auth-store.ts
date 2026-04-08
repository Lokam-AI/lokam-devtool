import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiLogin, apiMe, apiLogout } from "@/lib/api";
import type { User, UserRole } from "@/types";

interface AuthState {
  user: User | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isAtLeast: (role: UserRole) => boolean;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  reviewer: 0,
  admin: 1,
  superadmin: 2,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      initialized: false,

      login: async (email, password) => {
        await apiLogin(email, password);
        const user = await apiMe();
        set({ user, initialized: true });
      },

      logout: async () => {
        try {
          await apiLogout();
        } catch {
          // ignore — clear local state anyway
        }
        set({ user: null, initialized: true });
      },

      refreshMe: async () => {
        try {
          const user = await apiMe();
          set({ user, initialized: true });
        } catch {
          set({ user: null, initialized: true });
        }
      },

      hasRole: (role) => get().user?.role === role,
      isAtLeast: (role) => {
        const user = get().user;
        if (!user) return false;
        return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[role];
      },
    }),
    {
      name: "lokam-auth",
      // Only persist the user object (no tokens — cookies handle auth)
      partialize: (state) => ({ user: state.user, initialized: state.initialized }),
    }
  )
);
