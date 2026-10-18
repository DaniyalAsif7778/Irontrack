import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { User } from "../../models/auth/user.model.js";

const SINGLE_USER_EMAIL = "owner@irontrack.local";

/** Initializes the one local owner without requiring signup or exposing a registration endpoint. */
export async function ensureSingleUser() {
  const accounts = await User.find().select("_id").limit(2).lean();
  if (accounts.length > 1) throw new Error("Single-user mode requires at most one account in the database.");

  if (accounts.length === 1) {
    process.env.SINGLE_USER_ID = String(accounts[0]._id);
    return process.env.SINGLE_USER_ID;
  }

  const id = new mongoose.Types.ObjectId();
  const user = await User.create({
    _id: id,
    name: process.env.SINGLE_USER_NAME?.trim() || "IronTrack Owner",
    email: SINGLE_USER_EMAIL,
    passwordHash: randomBytes(48).toString("hex"),
  });
  process.env.SINGLE_USER_ID = String(user._id);
  return process.env.SINGLE_USER_ID;
}
