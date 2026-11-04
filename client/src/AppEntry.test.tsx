import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AppEntry, { isKnownAppPath } from "./AppEntry";

describe("app route allowlist", () => {
  it.each(["/", "/login", "/signup", "/verify-email", "/reset-password", "/workout", "/workout/stats", "/routine", "/analytics", "/weight", "/schedules", "/settings", "/wellness", "/profile", "/exercise/goblet-squat"])("keeps %s routable", path => {
    expect(isKnownAppPath(path)).toBe(true);
  });

  it.each(["/not-a-page", "/about", "/exercise/", "/exercise/id/extra"])("rejects unknown app path %s", path => {
    expect(isKnownAppPath(path)).toBe(false);
  });

  it("shows the recovery page for an unknown URL instead of sending it to sign-in", () => {
    render(<MemoryRouter initialEntries={["/not-a-page"]}><AppEntry /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "This page isn’t here" })).toBeInTheDocument();
  });
});
