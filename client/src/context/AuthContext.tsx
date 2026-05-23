import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authApi } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, verify stored session by calling /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      try {
        // Try to verify the session is still valid
        const data = await authApi.me();
        if (cancelled) return;
        setUser(data.user);
        // Update stored user in case name changed
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch {
        // Token might be expired — try refresh
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          clearSession();
          return;
        }

        try {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (!refreshRes.ok) throw new Error("Refresh failed");
          const refreshData = await refreshRes.json();

          if (cancelled) return;
          localStorage.setItem("accessToken", refreshData.accessToken);
          localStorage.setItem("refreshToken", refreshData.refreshToken);

          // Now fetch the user profile with the new token
          const meData = await authApi.me();
          if (cancelled) return;
          setUser(meData.user);
          localStorage.setItem("user", JSON.stringify(meData.user));
        } catch {
          clearSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    function clearSession() {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setUser(null);
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await authApi.register({ name, email, password });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore errors during logout
      }
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
