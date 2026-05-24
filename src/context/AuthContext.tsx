import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setTokens, clearTokens, setRefreshHandler } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthCtx {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const AuthContext = createContext<AuthCtx>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  // Restore tokens from localStorage on mount
  useEffect(() => {
    const at = localStorage.getItem("accessToken");
    const rt = localStorage.getItem("refreshToken");
    if (at && rt) {
      setTokens(at, rt);
    }
  }, []);

  // Wire up the refresh handler for apiFetch 401 interception
  useEffect(() => {
    setRefreshHandler(async () => {
      const rt = localStorage.getItem("refreshToken");
      if (!rt) return false;
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) {
          setTokens(null, null);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          setUser(null);
          return false;
        }
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return true;
      } catch {
        return false;
      }
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Error al iniciar sesión");
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Error al registrarse");
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
    } catch {
      // Ignore errors on logout
    }
    clearTokens();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
