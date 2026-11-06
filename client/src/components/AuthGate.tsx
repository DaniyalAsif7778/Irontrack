import { createContext, lazy, Suspense, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, api } from "../lib/api/api";
import type { AuthUser } from "../types";
import { setPageMetadata } from "../utils/seo";

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
  const navigate = useNavigate();
  const signInHome = location.pathname === "/";
  const authAction = ["/login", "/signup", "/verify-email", "/reset-password"].includes(location.pathname);
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        const response = await api<{ user: AuthUser | null }>("/auth/session");
        if (!response || typeof response !== "object" || !("user" in response)) {
          throw new ApiError("The server returned an invalid account session response.", 502);
        }
        if (response.user !== null && !isAuthUser(response.user)) {
          throw new ApiError("The server returned incomplete account details.", 502);
        }
        return response.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    enabled: true,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": session.data ? "Home · IronTrack" : "Sign in · IronTrack",
      "/login": "Sign in · IronTrack",
      "/signup": "Create account · IronTrack",
      "/verify-email": "Verify email · IronTrack",
      "/reset-password": "Reset password · IronTrack",
      "/workout": "Workout · IronTrack",
      "/workout/stats": "Workout insights · IronTrack",
      "/routine": "Prayer-anchored routine · IronTrack",
      "/analytics": "Progress analytics · IronTrack",
      "/weight": "Weight tracking · IronTrack",
      "/schedules": "Routine schedule · IronTrack",
      "/settings": "Account settings · IronTrack",
      "/wellness": "Wellness reminders · IronTrack",
      "/profile": "Profile · IronTrack",
    };
    setPageMetadata({ title: titles[location.pathname] ?? "IronTrack · Fitness and routines", robots: "noindex,nofollow" });
  }, [location.pathname, session.data, session.error, session.isError]);

  if (session.isPending && (authAction || signInHome)) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage /></Suspense>;
  if (session.isPending) return <main className="auth-screen"><p role="status">Checking your account…</p></main>;
  if (session.isError) {
    if (authAction || signInHome) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage connectionError="Something went wrong. Please try again later." /></Suspense>;
    return <main className="auth-screen"><section className="auth-card"><h1>Something went wrong</h1><p>Please try again later. Your sign-in details and saved data have not been changed.</p><button className="auth-submit" onClick={() => void session.refetch()}>Try again</button></section></main>;
  }
  if (!session.data) {
    if (authAction) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage /></Suspense>;
    return signInHome ? <Suspense fallback={<main className="auth-screen"><p role="status">Loading sign in…</p></main>}><AuthPage /></Suspense> : <Navigate to="/login" replace />;
  }
  if (["/login", "/signup"].includes(location.pathname)) return <Navigate to="/" replace />;
  if (["/verify-email", "/reset-password"].includes(location.pathname)) return <Suspense fallback={<main className="auth-screen"><p role="status">Loading account access…</p></main>}><AuthPage /></Suspense>;

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
      queryClient.clear();
      queryClient.setQueryData(sessionKey, null);
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return <SessionContext.Provider value={{ user: session.data, signOut }}>{children}</SessionContext.Provider>;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  const preferences = user.preferences;
  return typeof user.id === "string" && user.id.length > 0
    && typeof user.name === "string" && typeof user.email === "string"
    && Boolean(preferences && (preferences.weightUnit === "kg" || preferences.weightUnit === "lb")
      && Number.isFinite(preferences.focusMinutes) && Number.isFinite(preferences.breakMinutes)
      && preferences.prayerTimes && ["fajr", "dhuhr", "asr", "maghrib", "isha"].every(key => typeof preferences.prayerTimes[key as keyof typeof preferences.prayerTimes] === "string"));
}
