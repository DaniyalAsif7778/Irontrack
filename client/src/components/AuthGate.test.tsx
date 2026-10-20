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

  it("keeps private routes on the sign-in form for a signed-out visitor", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/workout");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("opens account creation directly from the public page", async () => {
    api.mockResolvedValue({ user: null });
    renderGate("/signup");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument());
  });
});
