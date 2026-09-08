import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userCreate: vi.fn(),
  userQuotaFindUnique: vi.fn(),
  userQuotaCreate: vi.fn(),
  userFileAggregate: vi.fn(),
  pointsTransactionCreate: vi.fn(),
  taskUpsert: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { userId?: string; userRole?: string }).userId = 'auth-user';
    (req as express.Request & { userId?: string; userRole?: string }).userRole = 'user';
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
      create: mocks.userCreate,
    },
    userQuota: {
      findUnique: mocks.userQuotaFindUnique,
      create: mocks.userQuotaCreate,
    },
    userFile: { aggregate: mocks.userFileAggregate },
    pointsTransaction: { create: mocks.pointsTransactionCreate },
    task: { upsert: mocks.taskUpsert },
  },
}));

import { syncRouter } from './sync';

describe('sync authority boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({
      id: 'auth-user',
      username: 'existing-user',
      email: 'stored-email-hash',
    });
    mocks.userQuotaFindUnique.mockResolvedValue({ storageLimit: 10_000, fileLimit: 1000 });
    mocks.userFileAggregate.mockResolvedValue({ _sum: { fileSize: 0 } });
  });

  it('ignores client balances, point transactions, and authoritative tasks', async () => {
    const app = express();
    app.use('/sync', syncRouter);

    const response = await request(app)
      .post('/sync/full')
      .send({
        userProfile: {
          userId: 'another-user',
          username: 'existing-user',
          email: '',
          membershipLevel: 'premium',
          membershipExpiry: null,
          permanentPoints: 999_999_999,
          bonusPoints: 999_999_999,
          bonusExpiry: null,
          concurrentTasks: 999,
          role: 'admin',
        },
        pointsTransactions: [{ type: 'earn', amount: 999_999_999, createdAt: new Date().toISOString() }],
        tasks: [{
          id: 'forged-task',
          taskType: 'video',
          provider: 'forged-provider',
          status: 'completed',
          inputParams: {},
          outputResult: { url: 'https://attacker.invalid/result.mp4' },
          progress: 100,
          createdAt: new Date().toISOString(),
        }],
      });

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.pointsTransactionCreate).not.toHaveBeenCalled();
    expect(mocks.taskUpsert).not.toHaveBeenCalled();
    expect(response.body.data.summary).toMatchObject({ pointsSynced: 0, tasksSynced: 0 });
  });
});
