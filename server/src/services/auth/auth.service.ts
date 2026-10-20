import bcrypt from "bcrypt";
import { User, toPublicUser, type PublicUser } from "../../models/auth/user.model.js";

const BCRYPT_ROUNDS = 12;

export async function registerAccount(data: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await User.create({ name: data.name, email: data.email, passwordHash });
  return toPublicUser(user);
}

export async function authenticateAccount(email: string, password: string): Promise<PublicUser | null> {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !await bcrypt.compare(password, user.passwordHash)) return null;
  return toPublicUser(user);
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
