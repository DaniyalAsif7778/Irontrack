import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskDialog from "./TaskDialog";

const prayerTimes = { fajr: "05:00", dhuhr: "12:00", asr: "15:30", maghrib: "18:20", isha: "20:00" };

describe("TaskDialog", () => {
  it("announces itself as a dialog, contains keyboard focus, and closes on Escape", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<TaskDialog editing={{ block: "fajr" }} prayerTimes={prayerTimes} onClose={onClose} onSave={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "New routine task" });
    const title = screen.getByLabelText("Task title");
    const save = screen.getByRole("button", { name: "Save task" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(title).toHaveFocus();
    save.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("defaults to a Fajr block with a calculated end and a Dhuhr boundary", () => {
    const onSave = vi.fn();
    render(<TaskDialog editing={{ block: "fajr" }} prayerTimes={prayerTimes} onClose={vi.fn()} onSave={onSave} />);

    expect(screen.getByLabelText("Block time (minutes)")).toHaveValue(45);
    expect(screen.getByLabelText(/Starts in Fajr block/)).toHaveValue("05:00");
    expect(screen.getByLabelText("Calculated end time")).toHaveValue("05:45");
    expect(screen.getByLabelText(/Starts in Fajr block/)).toHaveAttribute("max", "11:15");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calculates end time from duration and submits it with the task", async () => {
    const onSave = vi.fn();
    render(<TaskDialog editing={{ block: "asr" }} prayerTimes={prayerTimes} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Exercise" } });
    fireEvent.change(screen.getByPlaceholderText("Description"), { target: { value: "Mobility work" } });
    fireEvent.change(screen.getByPlaceholderText("Type"), { target: { value: "physical" } });
    fireEvent.change(screen.getByPlaceholderText("Category"), { target: { value: "Health" } });
    fireEvent.change(screen.getByLabelText("Block time (minutes)"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText(/Starts in Asr block/), { target: { value: "16:00" } });
    expect(screen.getByLabelText("Calculated end time")).toHaveValue("16:40");
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

  it("rejects overlapping timed tasks in the same prayer block", async () => {
    const onSave = vi.fn();
    const scheduledTasks = [{ _id: "existing", title: "Existing", startTime: "05:30", endTime: "06:15" }] as never;
    render(<TaskDialog editing={{ block: "fajr" }} prayerTimes={prayerTimes} scheduledTasks={scheduledTasks} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Read" } });
    fireEvent.change(screen.getByLabelText(/Starts in Fajr block/), { target: { value: "05:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));

    expect(await screen.findByText(/overlaps another task/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
