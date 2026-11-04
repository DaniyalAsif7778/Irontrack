import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGate, { useSession } from "./AuthGate";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api/api", () => ({ ApiError: Error, api, isRemoteApi: () => true }));

function SignOutControl() {
  const { signOut } = useSession();
  return <button type="button" onClick={() => void signOut()}>Sign out test</button>;
}

function renderGate(path: string, child = <p>Private app</p>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><AuthGate>{child}</AuthGate></MemoryRouter></QueryClientProvider>);
}

describe("AuthGate sign-in entry", () => {
  beforeEach(() => api.mockReset());

  it("shows sign-in at the root for a signed-out visitor", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("keeps sign-in available while account lookup continues", async () => {
    let resolveSession!: (value: unknown) => void;
    api.mockReturnValueOnce(new Promise(resolve => { resolveSession = resolve; }));
    renderGate("/");

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();

    resolveSession({ user: { id: "user-1", name: "Amina", email: "amina@example.com", preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } } } });
    expect(await screen.findByText("Private app")).toBeInTheDocument();
  });

  it("keeps the sign-in form available with a generic session error", async () => {
    api.mockResolvedValueOnce(undefined);
    renderGate("/");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again later.");
  });

  it("keeps sign-in available when the server cannot be reached", async () => {
    api.mockRejectedValueOnce(new Error("server unavailable"));
    renderGate("/");

    expect(await screen.findByRole("heading", { name: "Welcome back" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again later.");
  });
  it("sends signed-out visitors from a protected route to sign-in", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/workout");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("opens account creation directly from the public page", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/signup");
    expect(await screen.findByRole("heading", { name: "Create your account" }, { timeout: 10_000 })).toBeInTheDocument();
  }, 15_000);
  it("redirects to sign-in after the server confirms sign-out", async () => {
    api.mockImplementation((path: string) => path === "/auth/me"
      ? Promise.resolve({ user: { id: "user-1", name: "Amina", email: "amina@example.com", preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } } } })
      : Promise.resolve({}));
    renderGate("/profile", <SignOutControl />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign out test" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
  });
});
