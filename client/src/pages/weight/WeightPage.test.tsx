import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WeightPage from "./WeightPage";

describe("WeightPage", () => {
  it("shows an empty history and logs a valid entry using the selected unit", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<WeightPage latest={undefined} weights={[]} save={save} remove={vi.fn()} defaultUnit="lb" />);

    expect(screen.getByText("No entries")).toBeInTheDocument();
    expect(screen.getByText("No weight logs yet.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "181.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Log weight" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ weight: 181.25, unit: "lb" })));
  });

  it("rejects an invalid weight and allows deleting a history entry", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const save = vi.fn();
    render(<WeightPage latest={{ _id: "w1", date: "2026-10-20", weight: 80.4, unit: "kg" }} weights={[{ _id: "w1", date: "2026-10-20", weight: 80.4, unit: "kg" }]} save={save} remove={remove} />);

    expect(screen.getAllByText("80.4 kg")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Log weight" }));
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(remove).toHaveBeenCalledWith("w1");
  });
});
