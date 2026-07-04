import bcrypt from 'bcrypt';

export type AdminCredential = {
  username: string;
  passwordHash: string;
};

export function getPrimaryAdminCredential(): AdminCredential {
  const username = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

  if (!username) {
    throw new Error('ADMIN_USERNAME must be set');
  }
  if (!passwordHash) {
    throw new Error('ADMIN_PASSWORD_HASH must be set (plaintext ADMIN_PASSWORD is not allowed)');
  }

  return { username, passwordHash };
}

/** Optional extra admins — JSON array: [{ "username", "passwordHash" }, ...] */
export function parseAdditionalAdminUsers(): AdminCredential[] {
  const raw = process.env.ADMIN_ADDITIONAL_USERS?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ADMIN_ADDITIONAL_USERS must be valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('ADMIN_ADDITIONAL_USERS must be a JSON array');
  }

  const seen = new Set<string>();
  const users: AdminCredential[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as { username?: unknown; passwordHash?: unknown };
    const username = typeof row.username === 'string' ? row.username.trim() : '';
    const passwordHash = typeof row.passwordHash === 'string' ? row.passwordHash.trim() : '';
    if (!username || !passwordHash) continue;

    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    users.push({ username, passwordHash });
  }

  return users;
}

export function getAdminCredentialList(): AdminCredential[] {
  const primary = getPrimaryAdminCredential();
  const primaryKey = primary.username.toLowerCase();
  const additional = parseAdditionalAdminUsers().filter(
    (user) => user.username.toLowerCase() !== primaryKey
  );
  return [primary, ...additional];
}

export async function verifyAdminPassword(
  password: string,
  credential: AdminCredential
): Promise<boolean> {
  return bcrypt.compare(password, credential.passwordHash);
}

/** Returns the matched credential when username + password are valid. */
export async function authenticateAdminUser(
  username: string,
  password: string
): Promise<AdminCredential | null> {
  const normalizedUsername = username.trim();
  for (const credential of getAdminCredentialList()) {
    if (
      credential.username === normalizedUsername &&
      (await verifyAdminPassword(password, credential))
    ) {
      return credential;
    }
  }
  return null;
}
