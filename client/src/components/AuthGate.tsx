import { createContext, lazy, Suspense, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, api, isRemoteApi } from "../lib/api/api";
import type { AuthUser } from "../types";
import LandingPage from "../pages/public/LandingPage";

const AuthPage = lazy(() => import("../pages/auth/AuthPage"));

const sessionKey = ["auth", "me"] as const;
type SessionContextValue = { user: AuthUser | null; signOut: () => Promise<void> };
const SessionContext = createContext<SessionContextValue>({ user: null, signOut: async () => undefined });

export function useSession() {
  return useContext(SessionContext);
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const publicHome = location.pathname === "/";
  const authAction = ["/login", "/signup", "/verify-email", "/reset-password"].includes(location.pathname);
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        const response = await api<{ user: AuthUser }>("/auth/me");
        return response.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    enabled: isRemoteApi(),
    retry: false,
    staleTime: 60_000,
  });

  if (!isRemoteApi()) return <>{children}</>;
  if (session.isPending && authAction) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage /></Suspense>;
  if (session.isPending) return <main className="auth-screen"><p role="status">Checking your account…</p></main>;
  if (session.isError) return <main className="auth-screen"><section className="auth-card"><h1>Can’t reach your account</h1><p>{session.error.message}</p><button className="auth-submit" onClick={() => void session.refetch()}>Try again</button></section></main>;
  if (!session.data) {
    if (authAction) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage /></Suspense>;
    return publicHome ? <LandingPage /> : <Navigate to="/" replace />;
  }
  if (["/login", "/signup"].includes(location.pathname)) return <Navigate to="/" replace />;
  if (["/verify-email", "/reset-password"].includes(location.pathname)) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage /></Suspense>;

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
      queryClient.clear();
      queryClient.setQueryData(sessionKey, null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return <SessionContext.Provider value={{ user: session.data, signOut }}>{children}</SessionContext.Provider>;
}
