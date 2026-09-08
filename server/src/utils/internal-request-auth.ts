import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { config } from '../types/env';
import { getRequestAuthToken } from '../middleware/security-session';

const MAX_AGE_MS = 60_000;

function signature(scope: string, timestamp: string, token: string): string {
  return createHmac('sha256', config.jwt.secret)
    .update(`${scope}:${timestamp}:${token}`)
    .digest('base64url');
}

export function createInternalRequestAuthHeaders(scope: string, token?: string): Record<string, string> {
  if (!token) return {};
  const timestamp = String(Date.now());
  return {
    'X-AICGXT-Internal-Scope': scope,
    'X-AICGXT-Internal-Timestamp': timestamp,
    'X-AICGXT-Internal-Signature': signature(scope, timestamp, token),
  };
}

export function isTrustedInternalRequest(req: Request, scope: string): boolean {
  const requestScope = req.header('X-AICGXT-Internal-Scope');
  const timestamp = req.header('X-AICGXT-Internal-Timestamp');
  const receivedSignature = req.header('X-AICGXT-Internal-Signature');
  const { token } = getRequestAuthToken(req);
  if (!token || requestScope !== scope || !timestamp || !receivedSignature) return false;

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_AGE_MS) return false;

  const expectedSignature = signature(scope, timestamp, token);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
