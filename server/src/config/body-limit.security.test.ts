import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from './app';

const threeMegabytePayload = { data: 'x'.repeat(3 * 1024 * 1024) };

describe('request body limits', () => {
  it('rejects oversized JSON on ordinary API routes', async () => {
    const response = await request(app)
      .post('/api/v1/auth/body-limit-probe')
      .send(threeMegabytePayload);

    expect(response.status).toBe(413);
  });

  it('preserves the explicit media-route allowance', async () => {
    const response = await request(app)
      .post('/api/v1/image/body-limit-probe')
      .send(threeMegabytePayload);

    expect(response.status).not.toBe(413);
  });
});
