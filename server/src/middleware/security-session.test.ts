import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sessionCookieBridge } from './security-session';

function createAuthResponseApp() {
  const app = express();
  app.use(sessionCookieBridge);
  app.post('/api/v1/auth/login', (_req, res) => {
    res.json({
      success: true,
      data: {
        user: { id: 'user-1' },
        token: 'access-secret',
        refreshToken: 'refresh-secret',
      },
    });
  });
  return app;
}

describe('sessionCookieBridge', () => {
  it('returns only a non-sensitive sentinel to cookie-mode web clients', async () => {
    const response = await request(createAuthResponseApp())
      .post('/api/v1/auth/login')
      .set('X-Auth-Mode', 'cookie');

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe('cookie-session');
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.headers['set-cookie']).toHaveLength(2);
  });

  it('preserves bearer tokens for desktop clients', async () => {
    const response = await request(createAuthResponseApp()).post('/api/v1/auth/login');

    expect(response.body.data.token).toBe('access-secret');
    expect(response.body.data.refreshToken).toBe('refresh-secret');
  });
});
