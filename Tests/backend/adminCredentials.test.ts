import bcrypt from 'bcrypt';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  authenticateAdminUser,
  getAdminCredentialList,
  parseAdditionalAdminUsers,
} from '../../backend/src/lib/adminCredentials';

describe('adminCredentials', () => {
  const envBackup = { ...process.env };
  let test69Hash: string;

  beforeAll(async () => {
    test69Hash = await bcrypt.hash('test69', 4);
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('includes primary and additional users', () => {
    process.env.ADMIN_USERNAME = 'shivam69';
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$primary';
    process.env.ADMIN_ADDITIONAL_USERS = JSON.stringify([
      { username: 'test69', passwordHash: '$2b$12$extra' },
    ]);

    expect(getAdminCredentialList()).toEqual([
      { username: 'shivam69', passwordHash: '$2b$12$primary' },
      { username: 'test69', passwordHash: '$2b$12$extra' },
    ]);
  });

  it('skips duplicate additional username matching primary', () => {
    process.env.ADMIN_USERNAME = 'shivam69';
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$primary';
    process.env.ADMIN_ADDITIONAL_USERS = JSON.stringify([
      { username: 'shivam69', passwordHash: '$2b$12$dup' },
      { username: 'test69', passwordHash: '$2b$12$extra' },
    ]);

    expect(getAdminCredentialList()).toHaveLength(2);
    expect(getAdminCredentialList()[1].username).toBe('test69');
  });

  it('returns empty additional list when env unset', () => {
    delete process.env.ADMIN_ADDITIONAL_USERS;
    process.env.ADMIN_USERNAME = 'shivam69';
    process.env.ADMIN_PASSWORD_HASH = '$2b$12$primary';
    expect(parseAdditionalAdminUsers()).toEqual([]);
  });

  it('authenticates additional user test69', async () => {
    process.env.ADMIN_USERNAME = 'shivam69';
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('shivam-pass', 4);
    process.env.ADMIN_ADDITIONAL_USERS = JSON.stringify([
      { username: 'test69', passwordHash: test69Hash },
    ]);

    const matched = await authenticateAdminUser('test69', 'test69');
    expect(matched?.username).toBe('test69');

    const wrong = await authenticateAdminUser('test69', 'wrong');
    expect(wrong).toBeNull();
  });
});
