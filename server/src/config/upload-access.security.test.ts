import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from './app';

const fixtureDir = path.join(process.cwd(), 'uploads', 'workflows');
const fixturePath = path.join(fixtureDir, 'security-access-test.json');

describe('uploaded file access', () => {
  beforeAll(() => {
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(fixturePath, '{"nodes":[]}');
  });

  afterAll(() => {
    fs.rmSync(fixturePath, { force: true });
  });

  it('does not serve user uploads to anonymous requests', async () => {
    const response = await request(app).get('/uploads/workflows/security-access-test.json');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });
});
