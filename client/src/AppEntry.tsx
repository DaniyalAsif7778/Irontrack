import { useLocation } from "react-router-dom";
import App from "./App";
import { isRemoteApi } from "./lib/api/api";
import AuthGate from "./components/AuthGate";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import NotFoundPage from "./pages/errors/NotFoundPage";

const appPaths = new Set([
  "/", "/home", "/login", "/signup", "/verify-email", "/reset-password",
  "/workout", "/workout/stats", "/routine", "/analytics", "/weight",
  "/schedules", "/settings", "/wellness", "/profile",
]);

export function isKnownAppPath(pathname: string) {
  return appPaths.has(pathname) || /^\/exercise\/[^/]+$/.test(pathname);
}

export default function AppEntry() {
  const { pathname } = useLocation();
  if (!isRemoteApi() || isKnownAppPath(pathname)) return <GlobalErrorBoundary><AuthGate><App /></AuthGate></GlobalErrorBoundary>;
  return <GlobalErrorBoundary><NotFoundPage /></GlobalErrorBoundary>;
}
