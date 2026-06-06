import { describe, expect, it } from 'vitest';
import { toPublicReview } from '../../backend/src/lib/reviewHelpers';

describe('toPublicReview', () => {
  it('strips customer_email and internal fields from public responses', () => {
    const row = {
      id: 1,
      product_id: 2,
      customer_email: 'secret@example.com',
      customer_name: 'Alex',
      rating: 5,
      title: 'Great',
      content: 'Love it',
      status: 'approved',
      admin_notes: 'internal',
    };

    const pub = toPublicReview(row);
    expect(pub.customer_email).toBeUndefined();
    expect(pub.admin_notes).toBeUndefined();
    expect(pub.status).toBeUndefined();
    expect(pub.customer_name).toBe('Alex');
    expect(pub.rating).toBe(5);
  });
});
