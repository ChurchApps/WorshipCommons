import React, { createContext, useContext, useState } from "react";
import { corePost } from "./api";
import { clearLibraryCache } from "./library";

export interface WcUser { id: string; email: string; firstName: string; lastName: string; }

interface AuthContextValue {
  user: WcUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const stored = (): WcUser | null => {
  try {
    const raw = localStorage.getItem("wcUser");
    return raw && localStorage.getItem("wcJwt") ? JSON.parse(raw) : null;
  } catch { return null; }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WcUser | null>(stored);

  const login = async (email: string, password: string) => {
    const resp = await corePost("/membership/users/login", { email, password, appName: "WorshipCommons" });
    const u = resp?.user;
    if (!u?.jwt) throw new Error("Login failed");
    localStorage.setItem("wcJwt", u.jwt);
    localStorage.setItem("wcUser", JSON.stringify({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName }));
    clearLibraryCache();
    setUser({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName });
  };

  const logout = () => {
    localStorage.removeItem("wcJwt");
    localStorage.removeItem("wcUser");
    clearLibraryCache();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
};
