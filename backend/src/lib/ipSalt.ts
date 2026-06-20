/** IP anonymization salt — required in production (validated at startup). */
export function getIpSalt(): string {
  const salt = process.env.IP_SALT?.trim();
  if (salt) return salt;
  if (process.env.NODE_ENV === 'test') return 'test-ip-salt';
  if (process.env.NODE_ENV === 'production') {
    throw new Error('IP_SALT is required');
  }
  return 'dev-only-salt';
}
