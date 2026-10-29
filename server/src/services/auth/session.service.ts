import { randomUUID } from "node:crypto";
import { AuthSession } from "../../models/auth/session.model.js";
import { REFRESH_MAX_AGE, signRefreshSession, signSession, verifyRefreshSession } from "../../middlewares/requireAuth.js";

function expiry() {
  return new Date(Date.now() + REFRESH_MAX_AGE);
}

export type SessionRequestMetadata = { userAgent?: string; ipAddress?: string };

export async function issueSession(ownerId: string, metadata: SessionRequestMetadata = {}) {
  const tokenId = randomUUID();
  const refreshToken = signRefreshSession(ownerId, tokenId);
  await AuthSession.create({ ownerId, tokenId, expiresAt: expiry(), userAgent: metadata.userAgent?.slice(0, 512), ipAddress: metadata.ipAddress?.slice(0, 64), lastSeenAt: new Date() });
  return { accessToken: signSession(ownerId), refreshToken };
}

export async function rotateSession(token: string, metadata: SessionRequestMetadata = {}) {
  let current: ReturnType<typeof verifyRefreshSession>;
  try { current = verifyRefreshSession(token); }
  catch { return null; }

  const nextTokenId = randomUUID();
  const refreshToken = signRefreshSession(current.userId, nextTokenId);
  const session = await AuthSession.findOneAndUpdate(
    { ownerId: current.userId, tokenId: current.tokenId, expiresAt: { $gt: new Date() } },
    { $set: { tokenId: nextTokenId, expiresAt: expiry(), lastSeenAt: new Date(), ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}), ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 64) } : {}) } },
    { new: true },
  );
  if (!session) return null;
  return { accessToken: signSession(current.userId), refreshToken };
}

export async function listSessions(ownerId: string, currentRefreshToken?: string) {
  let currentTokenId: string | undefined;
  if (currentRefreshToken) {
    try { currentTokenId = verifyRefreshSession(currentRefreshToken).tokenId; } catch { /* The current session may have expired. */ }
  }
  const rows = await AuthSession.find({ ownerId, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean();
  return rows.map((session: any) => ({
    id: String(session._id), userAgent: session.userAgent ?? "", ipAddress: session.ipAddress ?? "",
    createdAt: session.createdAt, lastSeenAt: session.lastSeenAt ?? session.updatedAt,
    current: session.tokenId === currentTokenId,
  }));
}

export async function revokeSessionById(ownerId: string, id: string) {
  const result = await AuthSession.deleteOne({ _id: id, ownerId });
  return result.deletedCount > 0;
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
