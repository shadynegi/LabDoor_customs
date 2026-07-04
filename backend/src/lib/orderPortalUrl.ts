/** Build order tracking URL for WhatsApp notifications (order ID pre-filled; email entered on page). */
export function buildOrderPortalUrl(
  data: { orderId?: string },
  frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173',
): string {
  const base = frontendUrl.replace(/\/$/, '');

  if (data.orderId) {
    return `${base}/orders?orderId=${encodeURIComponent(data.orderId)}`;
  }

  return `${base}/orders`;
}
