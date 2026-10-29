import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../../lib/api/api", () => ({ api }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={["/routine"]}>
      <AuthPage />
      <LocationProbe />
    </MemoryRouter>
  </QueryClientProvider>);
}

describe("account access flow", () => {
  beforeEach(() => api.mockReset());

  it("asks new accounts to verify their email before signing in", async () => {
    api.mockResolvedValue({ message: "If this address can receive mail, a verification link is on its way." });
    renderAuth();

    fireEvent.click(screen.getByRole("tab", { name: /create account/i }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Daniyal" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "daniyal@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/signup");
    expect(api).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ method: "POST" }));
  });

});
