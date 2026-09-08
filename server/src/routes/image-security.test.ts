import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { imageRouter } from './image';

describe('image proxy security', () => {
  it('requires authentication before validating proxy parameters', async () => {
    const app = express();
    app.use(imageRouter);

    const response = await request(app).get('/proxy-stream');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });
});
