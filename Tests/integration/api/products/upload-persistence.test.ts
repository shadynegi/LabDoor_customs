import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../../../backend/src/server';
import { createCsrfAgent, withCsrf } from '../../../shared/helpers/http';
import { adminSessionCookie, createTestAdminToken } from '../../../shared/helpers/adminAuth';
import { sqlMock } from '../../../setup';
import { ensureUploadDirs, getProductsUploadDir, getUploadRoot } from '../../../../backend/src/lib/productUpload';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.UPLOAD_DIR;
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

describe('Railway volume upload persistence (integration)', () => {
  it('writes admin product uploads under UPLOAD_DIR/products', async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldc-volume-persist-'));
    tempDirs.push(uploadDir);
    process.env.UPLOAD_DIR = uploadDir;
    mockAdminSession();

    const imageBytes = Buffer.from('persisted-railway-volume-image-bytes');
    const { agent, csrfToken } = await createCsrfAgent();
    const token = createTestAdminToken();
    const res = await withCsrf(
      agent
        .post('/api/admin/uploads/product-media')
        .set('Cookie', adminSessionCookie(token)),
      csrfToken
    ).attach('image', imageBytes, {
      filename: 'volume-shoe.png',
      contentType: 'image/png',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const storedName = path.basename(res.body.data.image);
    const absolutePath = path.join(uploadDir, 'products', storedName);
    expect(fs.existsSync(absolutePath)).toBe(true);
    expect(fs.readFileSync(absolutePath)).toEqual(imageBytes);
  });

  it('keeps uploaded files after simulated redeploy (same UPLOAD_DIR volume)', async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldc-volume-redeploy-'));
    tempDirs.push(uploadDir);
    process.env.UPLOAD_DIR = uploadDir;
    mockAdminSession();

    const imageBytes = Buffer.from('survives-container-restart');
    const { agent, csrfToken } = await createCsrfAgent();
    const token = createTestAdminToken();
    const uploadRes = await withCsrf(
      agent
        .post('/api/admin/uploads/product-media')
        .set('Cookie', adminSessionCookie(token)),
      csrfToken
    ).attach('image', imageBytes, {
      filename: 'redeploy-shoe.png',
      contentType: 'image/png',
    });

    expect(uploadRes.status).toBe(200);
    const publicPath = uploadRes.body.data.image as string;
    const storedName = path.basename(publicPath);

    // Simulate Railway redeploy: new process boot, same mounted volume path in env.
    ensureUploadDirs();
    const resolvedRoot = getUploadRoot();
    const resolvedProductsDir = getProductsUploadDir();
    expect(resolvedRoot).toBe(path.resolve(uploadDir));
    expect(resolvedProductsDir).toBe(path.join(path.resolve(uploadDir), 'products'));

    const persistedPath = path.join(resolvedProductsDir, storedName);
    expect(fs.existsSync(persistedPath)).toBe(true);
    expect(fs.readFileSync(persistedPath)).toEqual(imageBytes);
    expect(publicPath).toBe(`/uploads/products/${storedName}`);
  });

  it('does not remove existing files when ensureUploadDirs runs again', async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldc-volume-mkdir-'));
    tempDirs.push(uploadDir);
    process.env.UPLOAD_DIR = uploadDir;

    const productsDir = path.join(uploadDir, 'products');
    fs.mkdirSync(productsDir, { recursive: true });
    const legacyFile = path.join(productsDir, 'legacy-pre-volume.png');
    fs.writeFileSync(legacyFile, Buffer.from('legacy-volume-file'));

    ensureUploadDirs();
    ensureUploadDirs();

    expect(fs.existsSync(legacyFile)).toBe(true);
    expect(fs.readFileSync(legacyFile).toString()).toBe('legacy-volume-file');
  });
});
