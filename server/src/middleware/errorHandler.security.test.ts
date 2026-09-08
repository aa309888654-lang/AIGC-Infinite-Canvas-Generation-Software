import { describe, expect, it, vi } from 'vitest';
import { notFoundHandler } from './errorHandler';

describe('notFoundHandler', () => {
  it('does not reflect the attacker-controlled request URL', () => {
    const next = vi.fn();
    const req = {
      method: 'GET',
      originalUrl: '/api/<script>alert(1)</script>',
    } as any;

    notFoundHandler(req, {} as any, next);

    const error = next.mock.calls[0][0] as Error;
    expect(error.message).toBe('接口不存在');
    expect(error.message).not.toContain(req.originalUrl);
  });
});
