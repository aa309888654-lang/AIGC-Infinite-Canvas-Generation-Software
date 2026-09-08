import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from './app';

describe('BREACH and CSP response hardening', () => {
  it('prevents compression transforms on the root response', async () => {
    const response = await request(app).get('/').set('Accept-Encoding', 'gzip, deflate');

    expect(response.headers['content-encoding']).toBe('identity');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['cache-control']).toContain('no-transform');
  });

  it('keeps the authentication API behavior while disabling compression', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Accept-Encoding', 'gzip, deflate');

    expect(response.status).toBe(401);
    expect(response.headers['content-encoding']).toBe('identity');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['cache-control']).toContain('no-transform');
  });

  it('does not allow generic eval in the enforced CSP', async () => {
    const response = await request(app).get('/');
    const csp = response.headers['content-security-policy'] ?? '';
    const scriptSources = csp.match(/script-src ([^;]+)/)?.[1] ?? '';

    expect(scriptSources).not.toContain("'unsafe-eval'");
    expect(scriptSources).not.toContain("'unsafe-inline'");
  });
});
