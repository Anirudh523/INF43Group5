import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setApiAuthToken, setUnauthorizedHandler } from "../api/client";
import type { UserSession } from "../types";

const STORAGE_KEY = "findme_session";

type AuthContextValue = {
  session: UserSession | null;
  loading: boolean;
  signIn: (session: UserSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw);
          if (!saved.token) {
            AsyncStorage.removeItem(STORAGE_KEY);
            setApiAuthToken(null);
            return;
          }
          setSession(saved);
          setApiAuthToken(saved.token);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (s: UserSession) => {
    setSession(s);
    setApiAuthToken(s.token);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    setApiAuthToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
