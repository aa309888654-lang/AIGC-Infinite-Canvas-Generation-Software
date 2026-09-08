import { describe, expect, it } from 'vitest';
import * as fileManagement from './file-management';

describe('file upload security policy', () => {
  it('exports a policy that validates upload metadata and content', () => {
    expect(typeof (fileManagement as any).validateUploadSecurity).toBe('function');
  });

  it('exports the local file URL builder', () => {
    expect(typeof (fileManagement as any).buildLocalFileUrl).toBe('function');
  });

  it('places new local files under the authenticated user directory', () => {
    const buildUrl = (fileManagement as any).buildLocalFileUrl;

    expect(buildUrl('asset.png', 'images', '11111111-1111-4111-8111-111111111111'))
      .toContain('/uploads/images/11111111-1111-4111-8111-111111111111/asset.png');
  });

  it('allows only parseable JSON workflows', () => {
    const validate = (fileManagement as any).validateUploadSecurity;

    expect(validate({
      folder: 'workflows',
      originalName: 'workflow.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"nodes":[]}'),
    })).toEqual({ allowed: true });

    expect(validate({
      folder: 'workflows',
      originalName: 'workflow.json',
      mimeType: 'application/json',
      buffer: Buffer.from('<script>alert(1)</script>'),
    }).allowed).toBe(false);
  });

  it('rejects active content and MIME-extension mismatches', () => {
    const validate = (fileManagement as any).validateUploadSecurity;
    const payload = Buffer.from('<html><script src="payload.js"></script></html>');

    expect(validate({
      folder: 'workflows',
      originalName: 'payload.html',
      mimeType: 'text/plain',
      buffer: payload,
    }).allowed).toBe(false);
    expect(validate({
      folder: 'workflows',
      originalName: 'payload.js',
      mimeType: 'application/javascript',
      buffer: payload,
    }).allowed).toBe(false);
    expect(validate({
      folder: 'images',
      originalName: 'payload.html',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    }).allowed).toBe(false);
  });
});
