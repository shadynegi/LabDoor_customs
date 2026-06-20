/** Thrown when a PayPal webhook must be retried (handler should return 500). */
export class WebhookProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookProcessingError';
  }
}
