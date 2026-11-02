import { CalendarDays, ChevronRight, CircleUserRound, HeartPulse, LogOut, Scale, Settings } from "lucide-react";
import type { AppView, AuthUser } from "../../types";

type ProfilePageProps = {
  user: AuthUser | null;
  onNavigate: (view: AppView) => void;
  onSignOut: () => Promise<void>;
};

const profileLinks: { view: AppView; label: string; description: string; icon: typeof HeartPulse }[] = [
  { view: "wellness", label: "Wellness & reminders", description: "Daily check-ins and notification preferences", icon: HeartPulse },
  { view: "settings", label: "Settings", description: "Account details, units, and focus preferences", icon: Settings },
  { view: "weight", label: "Body weight", description: "Log entries and follow your trend", icon: Scale },
  { view: "schedules", label: "Schedules", description: "Manage weekday and weekend routines", icon: CalendarDays },
];

export default function ProfilePage({ user, onNavigate, onSignOut }: ProfilePageProps) {
  return <>
    <header>
      <div>
        <h1>Profile</h1>
        <p>Your account and personal preferences.</p>
      </div>
    </header>
    <section className="profile-account" aria-label="Account">
      <span className="profile-avatar"><CircleUserRound size={24} /></span>
      <div>
        <b>{user?.name ?? "Local demo"}</b>
        <span>{user?.email ?? "Your data is stored on this device."}</span>
      </div>
    </section>
    <nav className="profile-links" aria-label="Profile options">
      {profileLinks.map(({ view, label, description, icon: Icon }) => (
        <button type="button" key={view} onClick={() => onNavigate(view)}>
          <Icon size={19} aria-hidden="true" />
          <span><b>{label}</b><small>{description}</small></span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      ))}
    </nav>
    {user && <button className="profile-sign-out" type="button" onClick={() => void onSignOut()}>
      <LogOut size={17} aria-hidden="true" /> Sign out
    </button>}
  </>;
}
