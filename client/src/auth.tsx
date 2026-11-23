import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type User } from "./api";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** Admin sign-in. Visitors never log in — they get a guest account automatically. */
  login: (email: string, password: string) => Promise<void>;
  /** Leaves the admin session and returns to this browser's guest account on the showtimes page. */
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);
/** Token for whoever is signed in right now (guest or admin) */
const TOKEN_KEY = "marquee_token";
/** This browser's guest account, kept across admin sessions so its tickets stay */
const GUEST_TOKEN_KEY = "marquee_guest_token";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the session still works, it just won't persist.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => read(TOKEN_KEY) ?? read(GUEST_TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  // One in-flight guest creation at a time (React dev mode runs effects twice)
  const guestRequest = useRef<Promise<{ user: User; token: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startGuest() {
      guestRequest.current ??= api.guest();
      try {
        const result = await guestRequest.current;
        write(GUEST_TOKEN_KEY, result.token);
        write(TOKEN_KEY, result.token);
        if (!cancelled) {
          setUser(result.user);
          if (token !== result.token) setToken(result.token);
        }
      } finally {
        guestRequest.current = null;
      }
    }

    async function hydrate() {
      setLoading(true);
      try {
        if (!token) {
          await startGuest();
          return;
        }
        try {
          const { user: me } = await api.me(token);
          if (!cancelled) setUser(me);
        } catch {
          // Expired or unknown token: fall back to this browser's guest, else a fresh one
          const guestToken = read(GUEST_TOKEN_KEY);
          write(TOKEN_KEY, null);
          if (guestToken && guestToken !== token) {
            if (!cancelled) setToken(guestToken); // re-runs this effect with the guest token
            return;
          }
          write(GUEST_TOKEN_KEY, null);
          await startGuest();
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    write(TOKEN_KEY, result.token);
    setUser(result.user);
    setToken(result.token);
  }, []);

  const logout = useCallback(() => {
    write(TOKEN_KEY, read(GUEST_TOKEN_KEY));
    // Full load straight to showtimes; the app restarts as this browser's guest
    window.location.assign("/browse");
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
