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

function renderAuth(path = "/routine") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[path]}>
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

    await waitFor(() => expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument());
    expect(api).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ method: "POST" }));
    expect(screen.getByText(/daniyal@example.com/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return to sign in" })).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/signup");

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email: "daniyal@example.com" }),
    }));
  });

  it("keeps password-reset confirmation separate from account verification", async () => {
    api.mockResolvedValue({ message: "If an account exists, password reset instructions are on their way." });
    renderAuth();
    fireEvent.click(screen.getByRole("tab", { name: /sign in/i }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "daniyal@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Resend verification email" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to sign in" })).toBeInTheDocument();
  });

  it("completes sign-in and returns to the app home", async () => {
    api.mockResolvedValue({ user: { id: "user-1", name: "Daniyal", email: "daniyal@example.com", preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } } } });
    renderAuth("/login");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "daniyal@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "existing-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/"));
    expect(api).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("verifies an email from the one-time link and offers a sign-in return", async () => {
    api.mockResolvedValue({ message: "Your email has been verified." });
    renderAuth("/verify-email#token=single-use-token");
    expect(await screen.findByRole("heading", { name: "You’re all set" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/auth/verify-email", { method: "POST", body: JSON.stringify({ token: "single-use-token" }) });
    fireEvent.click(screen.getByRole("button", { name: "Return to sign in" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("completes a password reset from its one-time link", async () => {
    api.mockResolvedValue({ message: "Your password has been updated." });
    renderAuth("/reset-password#token=reset-token");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-password-longer-than-15" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "a-new-password-longer-than-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: "You’re all set" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/auth/password/reset", { method: "POST", body: JSON.stringify({ token: "reset-token", password: "a-new-password-longer-than-15" }) });
  });

  it("keeps an invalid verification link recoverable", async () => {
    renderAuth("/verify-email");
    expect(await screen.findByRole("alert")).toHaveTextContent("This verification link is invalid or expired.");
    fireEvent.click(screen.getByRole("button", { name: "Go to sign in" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

});
