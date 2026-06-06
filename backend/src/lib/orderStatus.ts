export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): { valid: boolean; message: string } {
  if (currentStatus === newStatus) {
    return { valid: true, message: 'Status unchanged' };
  }

  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  if (allowed.includes(newStatus)) {
    return { valid: true, message: 'Valid transition' };
  }

  return {
    valid: false,
    message: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${
      allowed.length > 0 ? allowed.join(', ') : 'none (final state)'
    }`,
  };
}

export const MAX_BULK_IDS = 500;
