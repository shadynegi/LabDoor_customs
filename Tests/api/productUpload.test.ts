import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../backend/src/server';
import { createCsrfAgent, withCsrf } from '../helpers/http';
import { adminSessionCookie, createTestAdminToken } from '../helpers/adminAuth';
import { sqlMock } from '../setup';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function mockAdminSession() {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const q = strings.join(' ');
    if (q.includes('admin_sessions')) {
      return [{ username: 'admin' }];
    }
    return [];
  });
}

describe('POST /api/admin/uploads/product-media', () => {
  it('requires admin authentication', async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await withCsrf(agent.post('/api/admin/uploads/product-media'), csrfToken).attach(
      'image',
      Buffer.from('fake-image'),
      { filename: 'shoe.png', contentType: 'image/png' }
    );

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('stores uploaded image and returns public URL', async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldc-upload-test-'));
    tempDirs.push(uploadDir);
    process.env.UPLOAD_DIR = uploadDir;
    mockAdminSession();

    const { agent, csrfToken } = await createCsrfAgent();
    const token = createTestAdminToken();
    const res = await withCsrf(
      agent
        .post('/api/admin/uploads/product-media')
        .set('Cookie', adminSessionCookie(token)),
      csrfToken
    ).attach('image', Buffer.from('fake-image-bytes'), {
      filename: 'shoe.png',
      contentType: 'image/png',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.image).toMatch(/^\/uploads\/products\/[0-9a-f-]+\.png$/);

    const storedName = path.basename(res.body.data.image);
    expect(fs.existsSync(path.join(uploadDir, 'products', storedName))).toBe(true);
  });
});
