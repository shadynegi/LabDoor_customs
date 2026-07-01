import sql from './db';

/** Generic copy for check/submit paths — avoids product or duplicate enumeration. */
export const GENERIC_REVIEW_ELIGIBILITY_MESSAGE =
  'A review may already exist for this product and email, or eligibility could not be confirmed.';
import { validateOptionalProductImageUrl } from './productImage';
/** True when a completed order for this email contains the product (JSON-safe). */
export async function checkVerifiedPurchase(
  email: string,
  productId: number,
  orderId?: string | null,
): Promise<boolean> {
  try {
    if (orderId) {
      const bound = await sql`
        SELECT 1 FROM orders
        WHERE id = ${orderId}::uuid
          AND LOWER(TRIM(customer_email)) = LOWER(TRIM(${email}))
          AND payment_status = 'completed'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN items IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof(items::jsonb) = 'array' THEN items::jsonb
                ELSE '[]'::jsonb
              END
            ) AS elem
            WHERE (elem->>'product_id')::int = ${productId}
          )
        LIMIT 1
      `;
      return bound.length > 0;
    }

    const result = await sql`
      SELECT 1 FROM orders
      WHERE customer_email = ${email}
        AND payment_status = 'completed'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN items IS NULL THEN '[]'::jsonb
              WHEN jsonb_typeof(items::jsonb) = 'array' THEN items::jsonb
              ELSE '[]'::jsonb
            END
          ) AS elem
          WHERE (elem->>'product_id')::int = ${productId}
        )
      LIMIT 1
    `;
    return result.length > 0;
  } catch {
    return false;
  }
}

const PUBLIC_REVIEW_KEYS = [
  'id',
  'product_id',
  'customer_name',
  'rating',
  'title',
  'content',
  'pros',
  'cons',
  'is_verified_purchase',
  'is_recommended',
  'images',
  'helpful_count',
  'not_helpful_count',
  'admin_response',
  'admin_response_at',
  'created_at',
  'updated_at',
] as const;

/** Strip PII and internal fields from a review row for public API responses. */
export function toPublicReview(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_REVIEW_KEYS) {
    if (row[key] !== undefined) {
      out[key] = row[key];
    }
  }
  return out;
}

export function sanitizeReviewImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];

  const validated: string[] = [];
  for (const raw of images.slice(0, 5)) {
    if (typeof raw !== 'string') continue;
    const result = validateOptionalProductImageUrl(raw, 'Review image');
    if (result.ok && result.value) {
      validated.push(result.value);
    }
  }
  return validated;
}
