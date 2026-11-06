import { Schema, model } from "mongoose";

const preferencesSchema = new Schema({
  taskTimes: { type: Boolean, default: true },
  workoutAtNine: { type: Boolean, default: true },
  hydration: { type: Boolean, default: false },
  movement: { type: Boolean, default: false },
  prayerTimes: { type: Boolean, default: false },
  performanceAlerts: { type: Boolean, default: true },
}, { _id: false });

export const PushSubscription = model("PushSubscription", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  timezone: { type: String, default: "UTC" },
  preferences: { type: preferencesSchema, default: () => ({}) },
}, { timestamps: true }));

export const PushDelivery = model("PushDelivery", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  deliveryKey: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true }));
PushDelivery.schema.index({ ownerId: 1, deliveryKey: 1 }, { unique: true });

export const NotificationSchedulerLease = model("NotificationSchedulerLease", new Schema({
  _id: { type: String, default: "push-scheduler" },
  ownerToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  lastProcessedAt: { type: Date },
}, { versionKey: false }));

export const ScheduledNotification = model("ScheduledNotification", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: "PushSubscription", required: true },
  scheduleKey: { type: String, required: true },
  category: { type: String, enum: ["task", "prayer", "workout", "hydration", "movement", "routine_block"], required: true },
  timezone: { type: String, required: true, default: "UTC" },
  scheduleDate: { type: String, required: true },
  workoutDayType: { type: String },
  sourceEventId: { type: String },
  title: { type: String, required: true },
  body: { type: String, required: true },
  url: { type: String, required: true },
  dueAt: { type: Date, required: true },
  deliveryDeadline: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  taskId: { type: Schema.Types.ObjectId, ref: "RoutineTask" },
  taskDate: { type: String },
  status: { type: String, enum: ["pending", "processing", "sent", "failed", "skipped", "expired"], default: "pending", required: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseToken: { type: String },
  leaseExpiresAt: { type: Date },
  lastAttemptAt: { type: Date },
  sentAt: { type: Date },
  lastError: { type: String, maxlength: 300 },
}, { timestamps: true }));
ScheduledNotification.schema.index({ ownerId: 1, scheduleKey: 1 }, { unique: true });
ScheduledNotification.schema.index({ status: 1, dueAt: 1, nextAttemptAt: 1, deliveryDeadline: 1 });
ScheduledNotification.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
