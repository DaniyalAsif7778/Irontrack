import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskDialog from "./TaskDialog";

describe("TaskDialog", () => {
  it("requires a title and a complete, increasing daily time block", async () => {
    const onSave = vi.fn();
    render(<TaskDialog editing={{ block: "fajr" }} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByText("Enter a task title.")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Read" } });
    fireEvent.change(screen.getByLabelText("Daily block starts"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByText("Set both start and end times, or leave both empty.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Daily block ends"), { target: { value: "08:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByText("End time must be after start time.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits the full task record including schedule, duration, reminder, and subtasks", async () => {
    const onSave = vi.fn();
    render(<TaskDialog editing={{ block: "asr" }} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Exercise" } });
    fireEvent.change(screen.getByPlaceholderText("Description"), { target: { value: "Mobility work" } });
    fireEvent.change(screen.getByPlaceholderText("Type"), { target: { value: "physical" } });
    fireEvent.change(screen.getByPlaceholderText("Category"), { target: { value: "Health" } });
    fireEvent.change(screen.getByLabelText("Planned duration"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Daily block starts"), { target: { value: "16:00" } });
    fireEvent.change(screen.getByLabelText("Daily block ends"), { target: { value: "16:40" } });
    fireEvent.change(screen.getByLabelText("Reminder time"), { target: { value: "15:50" } });
    fireEvent.click(screen.getByRole("button", { name: /Add subtask/ }));
    fireEvent.change(screen.getByLabelText("Subtask 1"), { target: { value: "Warm up" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(await screen.findByText("Save task")).toBeInTheDocument();
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: "Exercise", description: "Mobility work", type: "physical", category: "Health",
      duration: 40, startTime: "16:00", endTime: "16:40", reminderTime: "15:50",
      subtasks: [{ title: "Warm up", completed: false }],
    });
  });
});
