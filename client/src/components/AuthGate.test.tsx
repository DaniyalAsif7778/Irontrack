import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGate from "./AuthGate";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api/api", () => ({ ApiError: Error, api, isRemoteApi: () => true }));

function renderGate(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><AuthGate><p>Private app</p></AuthGate></MemoryRouter></QueryClientProvider>);
}

describe("AuthGate public entry", () => {
  beforeEach(() => api.mockReset());

  it("shows the public product page at the root for a signed-out visitor", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/");
    expect(await screen.findByRole("heading", { name: /make room for the work that matters/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create your account/i })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("list").querySelectorAll("li")).toHaveLength(5);
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("keeps the loading state until the server confirms whether a visitor has a session", async () => {
    let resolveSession!: (value: unknown) => void;
    api.mockReturnValueOnce(new Promise(resolve => { resolveSession = resolve; }));
    renderGate("/");

    expect(screen.getByRole("status")).toHaveTextContent(/checking your account/i);
    expect(screen.queryByRole("heading", { name: /make room for the work/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();

    resolveSession({ user: { id: "user-1", name: "Amina", email: "amina@example.com", preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } } } });
    expect(await screen.findByText("Private app")).toBeInTheDocument();
  });

  it("sends signed-out visitors from a protected route to the public landing page", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/workout");
    expect(await screen.findByRole("heading", { name: /make room for the work that matters/i })).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("opens account creation directly from the public page", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/signup");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument());
  });
});
