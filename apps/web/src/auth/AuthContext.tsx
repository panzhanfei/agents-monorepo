import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiSetAccessToken, clearAccessToken } from "@/api";
import { queryClient } from "@/query/client";
import { restoreSessionFromToken } from "./bootstrapSession";
import { clearAllStoredAuth, readStoredToken, writeStoredRefresh, writeStoredToken } from "./tokenStorage";
import type { IAuthContextValue, IAuthUser } from "./interface";

export type { IAuthUser } from "./interface";

const AuthContext = createContext<IAuthContextValue | undefined>(undefined);

const initialToken = readStoredToken();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    if (initialToken) apiSetAccessToken(initialToken);
    return initialToken;
  });
  const [user, setUser] = useState<IAuthUser | null>(null);

  useEffect(() => {
    if (!initialToken) return;
    void restoreSessionFromToken(initialToken).then((result) => {
      if (result.ok) {
        setUser(result.user);
        return;
      }
      if (result.cleared) {
        clearAllStoredAuth();
        setAccessTokenState(null);
        setUser(null);
      }
    });
  }, []);

  const setSession = useCallback((accessTokenValue: string, refreshToken: string, nextUser: IAuthUser) => {
    writeStoredToken(accessTokenValue);
    writeStoredRefresh(refreshToken);
    apiSetAccessToken(accessTokenValue);
    setAccessTokenState(accessTokenValue);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    clearAllStoredAuth();
    clearAccessToken();
    queryClient.clear();
    setAccessTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo<IAuthContextValue>(
    () => ({
      accessToken,
      user,
      setSession,
      clearSession,
    }),
    [accessToken, clearSession, setSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): IAuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
