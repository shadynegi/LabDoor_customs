# 📦 Order Management Guide

Complete guide for managing orders, tracking shipments, and updating order statuses.

## Table of Contents
- [Order Statuses](#order-statuses)
- [Managing Orders via Supabase](#managing-orders-via-supabase)
- [Managing Orders via API](#managing-orders-via-api)
- [Blue Dart Tracking Integration](#blue-dart-tracking-integration)
- [Common Workflows](#common-workflows)

---

## Order Statuses

### Order Status Values
- **`pending`** - Order placed but payment not yet confirmed
- **`processing`** - Payment confirmed, preparing for shipment
- **`shipped`** - Order has been shipped to customer
- **`delivered`** - Order successfully delivered
- **`cancelled`** - Order cancelled

### Payment Status Values
- **`pending`** - Payment not yet completed
- **`completed`** - Payment successfully processed
- **`failed`** - Payment failed
- **`refunded`** - Payment refunded to customer

---

## Managing Orders via Supabase Dashboard

### 1. View All Orders

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Click **Table Editor** → **orders**
4. You'll see all orders with full details

### 2. Update Order Status

```sql
-- In Supabase SQL Editor
UPDATE orders 
SET status = 'shipped' 
WHERE id = 'order-uuid-here';
```

### 3. Add Tracking Information

```sql
-- Add Blue Dart tracking number
UPDATE orders 
SET 
  tracking_number = 'BD123456789IN',
  tracking_url = 'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=BD123456789IN',
  carrier = 'Blue Dart',
  estimated_delivery = '2025-12-15',
  status = 'shipped'
WHERE id = 'order-uuid-here';
```

### 4. Mark Order as Delivered

```sql
UPDATE orders 
SET 
  status = 'delivered',
  delivered_at = NOW()
WHERE tracking_number = 'BD123456789IN';
```

---

## Managing Orders via API

### Base URL
```
http://localhost:5000/api/orders  (Development)
https://your-domain.com/api/orders  (Production)
```

### 1. Get All Orders (Admin)

**Request:**
```bash
curl -X GET "http://localhost:5000/api/orders"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_number": "GSS-1234567890-ABC123",
      "customer_email": "customer@example.com",
      "status": "processing",
      "total": 299.99
      // ... more fields
    }
  ],
  "count": 45
}
```

### 2. Get Orders by Customer Email

**Request:**
```bash
curl -X GET "http://localhost:5000/api/orders/customer/john@example.com"
```

**Response:**
```json
{
  "success": true,
  "data": [/* customer's orders */],
  "count": 3
}
```

### 3. Get Order by Order Number

**Request:**
```bash
curl -X GET "http://localhost:5000/api/orders/number/GSS-1234567890-ABC123"
```

### 4. Update Order Status

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/orders/{order-id}/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "shipped"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {/* updated order */},
  "message": "Order status updated successfully"
}
```

### 5. Update Order with Tracking Info

**Request:**
```bash
curl -X PUT "http://localhost:5000/api/orders/{order-id}" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "BD123456789IN",
    "tracking_url": "https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=BD123456789IN",
    "carrier": "Blue Dart",
    "estimated_delivery": "2025-12-15",
    "status": "shipped"
  }'
```

---

## Blue Dart Tracking Integration

### Tracking Number Format
Blue Dart tracking numbers typically follow these formats:
- `BD` followed by 9-11 digits (e.g., `BD123456789IN`)
- AWB numbers: 10-11 digits

### Tracking URL Format
```
https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo={TRACKING_NUMBER}
```

### Auto-Generate Tracking URL
If you only provide the tracking number, the system will automatically generate the Blue Dart tracking URL.

**Example:**
```sql
-- Just set tracking_number
UPDATE orders 
SET tracking_number = 'BD123456789IN'
WHERE id = 'order-uuid';

-- Frontend will auto-generate URL:
-- https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=BD123456789IN
```

---

## Common Workflows

### Workflow 1: New Order Processing

1. **Order Received** (Status: `processing`)
   - Customer completes PayPal payment
   - Order automatically saved to database
   - Customer receives confirmation

2. **Prepare Shipment**
   ```sql
   UPDATE orders 
   SET status = 'processing' 
   WHERE order_number = 'GSS-xxx';
   ```

3. **Create Shipping Label**
   - Generate Blue Dart shipping label
   - Get tracking number from Blue Dart

4. **Update with Tracking Info**
   ```sql
   UPDATE orders 
   SET 
     tracking_number = 'BD123456789IN',
     carrier = 'Blue Dart',
     estimated_delivery = '2025-12-15',
     status = 'shipped'
   WHERE order_number = 'GSS-xxx';
   ```

5. **Mark as Delivered** (When confirmed)
   ```sql
   UPDATE orders 
   SET 
     status = 'delivered',
     delivered_at = NOW()
   WHERE tracking_number = 'BD123456789IN';
   ```

### Workflow 2: Bulk Update Multiple Orders

```sql
-- Mark all processing orders as shipped (with tracking)
UPDATE orders 
SET 
  status = 'shipped',
  carrier = 'Blue Dart'
WHERE 
  status = 'processing' 
  AND tracking_number IS NOT NULL;
```

### Workflow 3: Handle Cancellation

```sql
UPDATE orders 
SET 
  status = 'cancelled',
  payment_status = 'refunded'
WHERE order_number = 'GSS-xxx';
```

---

## Customer Order Tracking

### Customer Flow

1. **Navigate to Orders Page**
   - Go to: `https://your-site.com/orders`
   - Or click "Orders" in navigation

2. **Enter Email**
   - Enter the email used during purchase
   - Click "Search"

3. **View Orders**
   - See all orders for that email
   - View order status, items, total
   - See tracking information (if available)

4. **Track Delivery**
   - Click "Track on Blue Dart" button
   - Opens Blue Dart tracking page in new tab
   - Shows real-time delivery status

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | Get all orders (admin) |
| POST | `/api/orders` | Create new order |
| GET | `/api/orders/:id` | Get order by ID |
| GET | `/api/orders/number/:orderNumber` | Get order by order number |
| GET | `/api/orders/customer/:email` | Get orders by email |
| PUT | `/api/orders/:id` | Update entire order |
| PATCH | `/api/orders/:id/status` | Update only status |
| PATCH | `/api/orders/:id/payment-status` | Update payment status |
| DELETE | `/api/orders/:id` | Delete order |
| GET | `/api/orders/stats/summary` | Get order statistics |

---

## Database Schema

### orders Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| order_number | VARCHAR(100) | Unique order number (GSS-xxx) |
| customer_email | VARCHAR(255) | Customer's email |
| customer_name | VARCHAR(255) | Customer's name |
| shipping_address | JSONB | Full shipping address |
| items | JSONB | Array of order items |
| subtotal | DECIMAL(10,2) | Subtotal amount |
| shipping_cost | DECIMAL(10,2) | Shipping cost |
| tax | DECIMAL(10,2) | Tax amount |
| total | DECIMAL(10,2) | Total amount |
| payment_status | VARCHAR(50) | Payment status |
| payment_method | VARCHAR(50) | Payment method (PayPal) |
| paypal_order_id | VARCHAR(255) | PayPal order ID |
| paypal_capture_id | VARCHAR(255) | PayPal capture ID |
| status | VARCHAR(50) | Order status |
| tracking_number | VARCHAR(100) | Shipping tracking number |
| tracking_url | TEXT | Full tracking URL |
| carrier | VARCHAR(50) | Shipping carrier (Blue Dart) |
| estimated_delivery | DATE | Estimated delivery date |
| delivered_at | TIMESTAMP | Actual delivery timestamp |
| created_at | TIMESTAMP | Order creation time |
| updated_at | TIMESTAMP | Last update time |

---

## Tips & Best Practices

### 1. Update Status Regularly
- Update order status as it progresses through fulfillment
- Customers appreciate visibility into their order status

### 2. Add Tracking ASAP
- Add tracking numbers as soon as the label is generated
- Customers can track shipments in real-time

### 3. Set Realistic Delivery Dates
```sql
-- Add 5-7 business days for standard shipping
UPDATE orders 
SET estimated_delivery = CURRENT_DATE + INTERVAL '7 days'
WHERE status = 'shipped';
```

### 4. Monitor Pending Orders
```sql
-- Find orders stuck in pending
SELECT order_number, customer_email, created_at
FROM orders 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '1 day';
```

### 5. Customer Communication
- Send email when order ships
- Include tracking number in email
- Notify when delivered

---

## Troubleshooting

### Orders Not Saving
1. Check Supabase connection
2. Verify `.env` has correct `SUPABASE_URL` and `SUPABASE_KEY`
3. Check backend logs for errors

### Customer Can't See Orders
1. Verify they're using the correct email
2. Check order exists in database:
   ```sql
   SELECT * FROM orders WHERE customer_email = 'email@example.com';
   ```

### Tracking Link Not Working
1. Verify tracking number is correct
2. Check Blue Dart website is accessible
3. Some tracking numbers take 24 hours to activate

---

## Support

For technical issues:
- Check backend logs: `backend/.logs/`
- Check Supabase dashboard for database errors
- Review API responses for error messages

For Blue Dart tracking issues:
- Contact Blue Dart customer support
- Verify tracking number format
- Check if shipment has been picked up

---

## Next Steps

1. **Setup Email Notifications**
   - Integrate SendGrid or similar
   - Send order confirmation emails
   - Send shipping notification with tracking

2. **Admin Dashboard** (Optional)
   - Build admin panel to manage orders visually
   - Bulk update capabilities
   - Order analytics and reports

3. **Automation** (Optional)
   - Auto-update delivery status from Blue Dart API
   - Auto-send notifications on status change
   - Integration with inventory management

---

**Last Updated:** December 8, 2025

