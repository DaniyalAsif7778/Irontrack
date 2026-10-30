import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { User, toPublicUser, type PublicUser } from "../../models/auth/user.model.js";
import { AuthChallenge, type AuthChallengePurpose } from "../../models/auth/authChallenge.model.js";
import { AuthSession } from "../../models/auth/session.model.js";
import { enqueueAuthEmail } from "./emailQueue.service.js";

const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hash("irontrack-nonexistent-account", BCRYPT_ROUNDS);

export async function registerAccount(data: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await User.create({ name: data.name, email: data.email, passwordHash, emailVerified: false, verificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  return toPublicUser(user);
}

export async function authenticateAccount(email: string, password: string): Promise<PublicUser | null> {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    await bcrypt.compare(password, await DUMMY_PASSWORD_HASH);
    return null;
  }
  if (!await bcrypt.compare(password, user.passwordHash)) return null;
  if (user.emailVerified === false) return null;
  return toPublicUser(user);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const challengeLifetime = 30 * 60 * 1000;

async function issueChallenge(userId: string, purpose: AuthChallengePurpose) {
  const token = randomBytes(32).toString("base64url");
  await AuthChallenge.deleteMany({ userId, purpose });
  await AuthChallenge.create({ userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + challengeLifetime) });
  return token;
}

export async function sendVerificationForEmail(email: string) {
  const user = await User.findOne({ email });
  if (!user || user.emailVerified) return;
  await User.updateOne({ _id: user._id, emailVerified: false }, { $set: { verificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  const token = await issueChallenge(String(user._id), "verify_email");
  try {
    await enqueueAuthEmail("verify_email", user.email, user.name, token);
  } catch (error) {
    await AuthChallenge.deleteMany({ userId: user._id, purpose: "verify_email", tokenHash: hashToken(token) });
    throw error;
  }
}

export async function verifyEmail(token: string) {
  const challenge = await AuthChallenge.findOneAndDelete({ purpose: "verify_email", tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!challenge) return false;
  const user = await User.findByIdAndUpdate(challenge.userId, { $set: { emailVerified: true }, $unset: { verificationExpiresAt: 1 } });
  await AuthChallenge.deleteMany({ userId: challenge.userId, purpose: "verify_email" });
  return Boolean(user);
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email });
  if (!user || !user.emailVerified) return;
  const token = await issueChallenge(String(user._id), "reset_password");
  try {
    await enqueueAuthEmail("reset_password", user.email, user.name, token);
  } catch (error) {
    await AuthChallenge.deleteMany({ userId: user._id, purpose: "reset_password", tokenHash: hashToken(token) });
    throw error;
  }
}

export async function resetPassword(token: string, password: string) {
  const challenge = await AuthChallenge.findOneAndDelete({ purpose: "reset_password", tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!challenge) return false;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.findByIdAndUpdate(challenge.userId, { $set: { passwordHash } });
  await Promise.all([
    AuthChallenge.deleteMany({ userId: challenge.userId, purpose: "reset_password" }),
    AuthSession.deleteMany({ ownerId: challenge.userId }),
  ]);
  return Boolean(user);
}

export async function getAccount(userId: string): Promise<PublicUser | null> {
  const user = await User.findById(userId);
  return user ? toPublicUser(user) : null;
}

export async function updateAccount(userId: string, data: { name?: string; preferences?: Partial<PublicUser["preferences"]> }): Promise<PublicUser | null> {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.preferences !== undefined) for (const [key, value] of Object.entries(data.preferences)) update[`preferences.${key}`] = value;
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  return user ? toPublicUser(user) : null;
}
