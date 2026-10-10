import React, { createContext, useContext, useEffect, useState } from "react";
import { corePost, wcGet } from "./api";
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

interface Props {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<Props> = (props) => {
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

  return <AuthContext.Provider value={{ user, login, logout }}>{props.children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
};

// one lookup per signed-in user: reviewers (server admins, music editors) may edit songs whose license closes them to the public
const reviewerChecks = new Map<string, Promise<boolean>>();

/** True when the signed-in user reviews submissions, false when not; undefined while it is being checked. */
export const useReviewer = (): boolean | undefined => {
  const { user } = useAuth();
  const [state, setState] = useState<{ id: string; reviewer: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    if (!reviewerChecks.has(user.id)) reviewerChecks.set(user.id, wcGet("/admin/status", true).then((s: any) => !!(s?.admin || s?.musicEditor)).catch(() => false));
    reviewerChecks.get(user.id)!.then(reviewer => { if (live) setState({ id: user.id, reviewer }); });
    return () => { live = false; };
  }, [user]);
  if (!user) return false;
  return state?.id === user.id ? state.reviewer : undefined;
};

const mineChecks = new Map<string, Promise<Set<string>>>();

/** True when the signed-in user may edit a song whose license closes it to public edits: a reviewer, or the song's publisher. Undefined while checking. */
export const useMayEditClosed = (songId?: string): boolean | undefined => {
  const { user } = useAuth();
  const reviewer = useReviewer();
  const [mine, setMine] = useState<{ id: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    if (!mineChecks.has(user.id)) mineChecks.set(user.id, wcGet("/songs/mine", true).then((rows: any) => new Set<string>((rows || []).map((r: any) => String(r.id)))).catch(() => new Set<string>()));
    mineChecks.get(user.id)!.then(ids => { if (live) setMine({ id: user.id, ids }); });
    return () => { live = false; };
  }, [user]);
  if (!user) return false;
  if (reviewer) return true;
  const ids = mine?.id === user.id ? mine.ids : undefined;
  if (reviewer === undefined || !ids) return undefined;
  return !!songId && ids.has(songId);
};
