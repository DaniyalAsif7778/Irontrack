import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlobalErrorBoundary from "./GlobalErrorBoundary";

function BrokenScreen(): never {
  throw new Error("private rendering detail");
}

describe("global render-error recovery", () => {
  it("shows a safe retry screen when a page throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<GlobalErrorBoundary><BrokenScreen /></GlobalErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This screen couldn’t load" })).toBeInTheDocument();
    expect(screen.queryByText("private rendering detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload app" })).toBeInTheDocument();
    error.mockRestore();
  });

});
