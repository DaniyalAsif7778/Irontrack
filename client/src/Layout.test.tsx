import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./Layout";

vi.mock("gsap", () => ({
  default: { registerPlugin: vi.fn(), context: vi.fn(), fromTo: vi.fn() },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("./components/NotificationCenter", () => ({ default: () => null }));
vi.mock("./components/InstallPrompt", () => ({ default: () => null }));
vi.mock("./components/components", () => ({ NavButton: ({ active, icon, children, onClick }: { active: boolean; icon: React.ReactNode; children: string; onClick: () => void }) => <button type="button" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{children}</span></button>, RoutineTimer: () => null }));

describe("mobile navigation", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
      matches: media.includes("prefers-reduced-motion"),
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  it("shows five thumb-reachable destinations with Profile as the fifth tab", () => {
    const setView = vi.fn();
    render(<MemoryRouter><AppShell view="home" setView={setView} user={null} signOut={vi.fn().mockResolvedValue(undefined)}><p>Content</p></AppShell></MemoryRouter>);

    const mobileNav = within(screen.getByRole("navigation", { name: "Mobile navigation" }));
    expect(mobileNav.getAllByRole("button")).toHaveLength(5);
    expect(mobileNav.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(mobileNav.getByRole("button", { name: "Train" })).toBeInTheDocument();
    expect(mobileNav.getByRole("button", { name: "Routine" })).toBeInTheDocument();
    expect(mobileNav.getByRole("button", { name: "Stats" })).toBeInTheDocument();
    fireEvent.click(mobileNav.getByRole("button", { name: "Profile" }));
    expect(setView).toHaveBeenCalledWith("profile");
  });

  it("keeps Profile marked current while one of its secondary pages is open", () => {
    render(<MemoryRouter><AppShell view="wellness" setView={vi.fn()} user={null} signOut={vi.fn().mockResolvedValue(undefined)}><p>Content</p></AppShell></MemoryRouter>);

    const mobileNav = within(screen.getByRole("navigation", { name: "Mobile navigation" }));
    expect(mobileNav.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });
});
