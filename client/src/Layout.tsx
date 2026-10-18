import { BarChart3, CalendarDays, Dumbbell, HeartPulse, HomeIcon, LogOut, Scale, Settings, Settings2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
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
  const primaryMobileItems = navItems.slice(0, 4);
  const moreItems = navItems.slice(4);
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const root = contentRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(root, { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out", clearProps: "all" });
      Array.from(root.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.matches("header, section, .dashboard, .blocks, .exercise-list, .recent-workouts, .chart-card")).forEach(target => gsap.fromTo(target, { autoAlpha: 0, y: 12 }, {
        autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", clearProps: "all",
        scrollTrigger: { trigger: target, start: "top 92%", once: true },
      }));
    }, root);
    return () => ctx.revert();
  }, [view]);
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="mobile-bar"><div className="brand-mark"><Dumbbell size={18} /><span>IronTrack</span></div><div className="mobile-bar-actions"><NotificationCenter onNavigate={setView} />{user && !user.singleUser && <button className="mobile-sign-out" type="button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={17} /></button>}</div></div>
    <aside className="sidebar">
      <div className="brand"><b><Dumbbell size={19} /> IronTrack</b><span>Strength, with intention</span></div>
      <nav aria-label="Main navigation">{navItems.map(item => <NavButton key={item.view} active={view === item.view} onClick={() => setView(item.view)} icon={item.icon}>{item.label}</NavButton>)}</nav>
      {user && <div className="account-menu"><span><b>{user.name}</b><small>{user.singleUser ? "Personal space" : user.email}</small></span>{!user.singleUser && <button type="button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={16} /></button>}</div>}
    </aside>
    <main id="main-content"><InstallPrompt /><div className="page-transition" ref={contentRef}>{children}</div></main>
    {moreOpen && <><button className="mobile-more-scrim" aria-label="Close more navigation" onClick={() => setMoreOpen(false)} /><nav className="mobile-more-menu" aria-label="More pages">{moreItems.map(item => <NavButton key={item.view} active={view === item.view} onClick={() => { setView(item.view); setMoreOpen(false); }} icon={item.icon}>{item.label}</NavButton>)}</nav></>}
    <nav className="mobile-nav" aria-label="Main navigation">{primaryMobileItems.map(item => <NavButton key={item.view} active={view === item.view} onClick={() => setView(item.view)} icon={item.icon}>{item.mobileLabel}</NavButton>)}<button type="button" className={moreOpen || moreItems.some(item => item.view === view) ? "active" : ""} aria-expanded={moreOpen} onClick={() => setMoreOpen(open => !open)}><Settings2 /><span>More</span></button></nav>
    <RoutineTimer key={user?.id ?? "local-demo"} userId={user?.id} focusMinutes={focusMinutes} breakMinutes={breakMinutes} />
  </div>;
}
