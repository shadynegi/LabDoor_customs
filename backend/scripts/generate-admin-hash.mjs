#!/usr/bin/env node
/**
 * Generate ADMIN_PASSWORD_HASH locally (never expose generate-hash in production).
 * Usage: node scripts/generate-admin-hash.mjs "your-secure-password"
 */
import bcrypt from 'bcrypt';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node scripts/generate-admin-hash.mjs "password-at-least-8-chars"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log('Add to backend .env:');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
