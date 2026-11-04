import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NotFoundPage from "./NotFoundPage";

describe("not-found recovery screen", () => {
  it("explains the missing page and links back to sign-in", () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "This page isn’t here" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/");
  });
});
