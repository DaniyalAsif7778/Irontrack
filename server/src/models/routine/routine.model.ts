import { Schema, model } from "mongoose";
import { BLOCKS, DAY_TYPES } from "../../constant.js";

const subtaskSchema = new Schema({ title: { type: String, required: true, trim: true }, completed: { type: Boolean, default: false } }, { _id: true });

export const RoutineTask = model("RoutineTask", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  dayType: { type: String, enum: DAY_TYPES, required: true, index: true },
  block: { type: String, enum: BLOCKS, required: true, index: true },
  sourceId: { type: String, default: "", index: true }, section: { type: String, default: "", maxlength: 80 },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  sourceCreatedAt: { type: Date, default: null }, sourceCompletedAt: { type: Date, default: null },
  order: { type: Number, default: 0 }, title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: "", maxlength: 4000 }, type: { type: String, default: "general", maxlength: 50 },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" }, category: { type: String, default: "Personal", maxlength: 80 },
  duration: { type: Number, default: 0, min: 0, max: 1440 }, dueDate: { type: String, default: "" }, reminderTime: { type: String, default: "" },
  startTime: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ }, endTime: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  subtasks: { type: [subtaskSchema], default: [] }
}, { timestamps: true }));

export const RoutineCompletion = model("RoutineCompletion", new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: "RoutineTask", required: true, index: true },
  date: { type: String, required: true, index: true }, completed: { type: Boolean, default: true }
}, { timestamps: true }));
RoutineCompletion.schema.index({ taskId: 1, date: 1 }, { unique: true });

export const RoutineTaskOccurrence = model("RoutineTaskOccurrence", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  taskId: { type: Schema.Types.ObjectId, ref: "RoutineTask", required: true, index: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  dayType: { type: String, enum: DAY_TYPES, required: true },
  block: { type: String, enum: BLOCKS, required: true },
  status: { type: String, enum: ["planned", "queued", "active", "completed", "deferred"], default: "planned", index: true },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  promptedForEndAt: { type: Date, default: null },
  timezone: { type: String, required: true, default: "UTC" },
  workMinutes: { type: Number, min: 1, max: 1440, default: 45 },
  extensionCount: { type: Number, min: 0, default: 0 },
  queueOrder: { type: Number, default: 0 },
  lastParentEventId: { type: String, default: "" },
}, { timestamps: true }));
RoutineTaskOccurrence.schema.index({ ownerId: 1, taskId: 1, date: 1 }, { unique: true });
RoutineTaskOccurrence.schema.index({ ownerId: 1, date: 1, status: 1, startAt: 1 });
RoutineTaskOccurrence.schema.index({ ownerId: 1 }, { unique: true, partialFilterExpression: { status: "active" }, name: "one_active_routine_task_per_owner" });
RoutineTaskOccurrence.schema.index({ ownerId: 1 }, { unique: true, partialFilterExpression: { status: "queued" }, name: "one_queued_routine_task_per_owner" });

export const RoutineReminder = model("RoutineReminder", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  taskId: { type: Schema.Types.ObjectId, ref: "RoutineTask", required: true, index: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  timezone: { type: String, required: true, default: "UTC" },
  status: { type: String, enum: ["scheduled", "sent", "ignored", "followup_sent", "responded", "deferred"], required: true },
  sentAt: { type: Date, default: null },
  followupSentAt: { type: Date, default: null },
  respondedAt: { type: Date, default: null },
  deferredAt: { type: Date, default: null },
}, { timestamps: true }));
RoutineReminder.schema.index({ ownerId: 1, taskId: 1, date: 1 }, { unique: true });
RoutineReminder.schema.index({ status: 1, sentAt: 1, followupSentAt: 1 });

export const RoutineEvent = model("RoutineEvent", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eventId: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  parentEventId: { type: String, default: "" },
  taskId: { type: Schema.Types.ObjectId, ref: "RoutineTask", default: null },
  occurrenceId: { type: Schema.Types.ObjectId, ref: "RoutineTaskOccurrence", default: null },
  date: { type: String, default: "" },
  type: { type: String, required: true, enum: ["task_started", "task_queued", "task_completed", "task_reopened", "task_created", "task_updated", "task_deleted", "schedule_copied", "task_snoozed", "extension_prompted", "task_extended", "reminder_ignored", "task_deferred", "push_sent", "push_failed", "notification_shown", "notification_clicked", "notification_dismissed", "notification_followup"] },
  occurredAt: { type: Date, required: true, default: Date.now },
  responseTimeMs: { type: Number, default: null, min: 0 },
  metadata: { type: Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true }));
RoutineEvent.schema.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true });
RoutineEvent.schema.index({ ownerId: 1, occurredAt: -1 });
RoutineEvent.schema.index({ occurredAt: 1 }, { expireAfterSeconds: 31_536_000, name: "routine_events_one_year_retention" });
