import { BarChart3, CalendarDays, CircleUserRound, Dumbbell, HeartPulse, HomeIcon, LogOut, Scale, Settings, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import type { AppView } from "./types";
import type { AuthUser } from "./types";
import { NavButton, RoutineTimer } from "./components/components";
import NotificationCenter from "./components/NotificationCenter";
import InstallPrompt from "./components/InstallPrompt";

type AppShellProps = {
  view: AppView;
  setView: (view: AppView) => void;
  user: AuthUser | null;
  signOut: () => Promise<void>;
  focusMinutes?: number;
  breakMinutes?: number;
  children: ReactNode;
};

export default function AppShell({ view, setView, user, signOut, focusMinutes = 45, breakMinutes = 15, children }: AppShellProps) {
  const navItems = [
    { view: "home" as const, label: "Home", mobileLabel: "Home", icon: <HomeIcon /> },
    { view: "workout" as const, label: "Workout", mobileLabel: "Train", icon: <Dumbbell /> },
    { view: "routine" as const, label: "Routine", mobileLabel: "Routine", icon: <CalendarDays /> },
    { view: "analytics" as const, label: "Analytics", mobileLabel: "Stats", icon: <BarChart3 /> },
    { view: "wellness" as const, label: "Wellness & reminders", mobileLabel: "Wellness", icon: <HeartPulse /> },
    { view: "weight" as const, label: "Body weight", mobileLabel: "Weight", icon: <Scale /> },
    { view: "schedules" as const, label: "Schedules", mobileLabel: "Schedules", icon: <Settings2 /> },
    { view: "settings" as const, label: "Settings", mobileLabel: "Settings", icon: <Settings /> },
  ];
  const mobileNavItems = [
    ...navItems.slice(0, 4),
    { view: "profile" as const, label: "Profile", mobileLabel: "Profile", icon: <CircleUserRound /> },
  ];
  const profileActive = ["profile", "wellness", "weight", "schedules", "settings"].includes(view);
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="mobile-bar"><div className="brand-mark"><Dumbbell size={18} /><span>IronTrack</span></div><div className="mobile-bar-actions"><NotificationCenter onNavigate={setView} /></div></div>
    <aside className="sidebar">
      <div className="brand"><b><Dumbbell size={19} /> IronTrack</b><span>Strength, with intention</span></div>
      <nav aria-label="Main navigation">{navItems.map(item => <NavButton key={item.view} active={view === item.view} onClick={() => setView(item.view)} icon={item.icon}>{item.label}</NavButton>)}</nav>
      {user && <div className="account-menu"><span><b>{user.name}</b><small>{user.email}</small></span><button type="button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={16} /></button></div>}
    </aside>
    <main id="main-content"><InstallPrompt /><div className="page-transition" key={view}>{children}</div></main>
    <nav className="mobile-nav" aria-label="Mobile navigation"><div className="mobile-nav-track">{mobileNavItems.map(item => <NavButton key={item.view} active={view === item.view || item.view === "profile" && profileActive} onClick={() => setView(item.view)} icon={item.icon}>{item.mobileLabel}</NavButton>)}</div></nav>
    <RoutineTimer key={user?.id ?? "local-demo"} userId={user?.id} focusMinutes={focusMinutes} breakMinutes={breakMinutes} />
  </div>;
}
