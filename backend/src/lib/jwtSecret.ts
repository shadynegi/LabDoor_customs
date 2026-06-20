import { logger } from './logger';

/** JWT secret complexity rules (shared by startup validation and admin auth). */
export function validateJwtSecretComplexity(secret: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (secret.length < 32) {
    issues.push('Must be at least 32 characters long');
  }
  if (!/[A-Z]/.test(secret)) {
    issues.push('Must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(secret)) {
    issues.push('Must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(secret)) {
    issues.push('Must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(secret)) {
    issues.push('Must contain at least one special character');
  }

  return { valid: issues.length === 0, issues };
}

export function assertJwtSecretForProduction(): void {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return;

  const validation = validateJwtSecretComplexity(secret);
  if (!validation.valid) {
    logger.error('JWT_SECRET does not meet complexity requirements:', validation.issues);
    process.exit(1);
  }
}
