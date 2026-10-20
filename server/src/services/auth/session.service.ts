import { randomUUID } from "node:crypto";
import { AuthSession } from "../../models/auth/session.model.js";
import { REFRESH_MAX_AGE, signRefreshSession, signSession, verifyRefreshSession } from "../../middlewares/requireAuth.js";

function expiry() {
  return new Date(Date.now() + REFRESH_MAX_AGE);
}

export async function issueSession(ownerId: string) {
  const tokenId = randomUUID();
  const refreshToken = signRefreshSession(ownerId, tokenId);
  await AuthSession.create({ ownerId, tokenId, expiresAt: expiry() });
  return { accessToken: signSession(ownerId), refreshToken };
}

export async function rotateSession(token: string) {
  let current: ReturnType<typeof verifyRefreshSession>;
  try { current = verifyRefreshSession(token); }
  catch { return null; }

  const nextTokenId = randomUUID();
  const refreshToken = signRefreshSession(current.userId, nextTokenId);
  const session = await AuthSession.findOneAndUpdate(
    { ownerId: current.userId, tokenId: current.tokenId, expiresAt: { $gt: new Date() } },
    { $set: { tokenId: nextTokenId, expiresAt: expiry() } },
    { new: true },
  );
  if (!session) return null;
  return { accessToken: signSession(current.userId), refreshToken };
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  try {
    const current = verifyRefreshSession(token);
    await AuthSession.deleteOne({ ownerId: current.userId, tokenId: current.tokenId });
  } catch {
    // Logout stays idempotent when the refresh cookie is absent, expired, or invalid.
  }
}
