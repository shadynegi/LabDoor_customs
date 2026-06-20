import { describe, expect, it } from 'vitest';
import { WebhookProcessingError } from '../../backend/src/lib/webhookErrors';

describe('WebhookProcessingError', () => {
  it('is an Error with a stable name', () => {
    const err = new WebhookProcessingError('capture not applied');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('WebhookProcessingError');
    expect(err.message).toBe('capture not applied');
  });
});
