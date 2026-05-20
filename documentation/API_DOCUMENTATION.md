# API Documentation - Lab Door Customs

Complete REST API documentation for the backend server.

## Base URL

- **Development:** `http://localhost:5000`
- **Production:** `https://your-api-domain.com`

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "count": 100,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100
  }
}
```

---

## General Endpoints

### Health Check

**GET** `/api/health`

Check if the server is running and view configuration.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running",
  "paypalMode": "sandbox",
  "paypalApi": "https://api-m.sandbox.paypal.com",
  "timestamp": "2024-12-08T10:30:00.000Z"
}
```

---

## Products API

### Get All Products

**GET** `/api/products`

Retrieve all products from the database.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Nike Drops - Blue",
      "price": 98.00,
      "image": "/assets/blue-nike.png",
      "description": "Self-lacing basketball shoe",
      "background": "/assets/blue-bg.png",
      "category": "Athletic",
      "stock": 50,
      "created_at": "2024-12-01T10:00:00Z",
      "updated_at": "2024-12-01T10:00:00Z"
    }
  ],
  "count": 5
}
```

### Get Product by ID

**GET** `/api/products/:id`

Retrieve a single product by its ID.

**Parameters:**
- `id` (number) - Product ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nike Drops - Blue",
    "price": 98.00,
    ...
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Product not found"
}
```

### Create Product

**POST** `/api/products`

Create a new product. (Admin only)

**Request Body:**
```json
{
  "name": "New Shoe Model",
  "price": 149.99,
  "image": "/assets/new-shoe.png",
  "description": "Latest athletic shoe",
  "background": "/assets/bg.png",
  "category": "Running",
  "stock": 100
}
```

**Required Fields:**
- `name` (string)
- `price` (number, >= 0)

**Response (201):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Product created successfully"
}
```

### Update Product

**PUT** `/api/products/:id`

Update an existing product. (Admin only)

**Request Body:**
```json
{
  "price": 129.99,
  "stock": 75,
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Product updated successfully"
}
```

### Delete Product

**DELETE** `/api/products/:id`

Delete a product. (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### Get Products by Category

**GET** `/api/products/category/:category`

Get all products in a specific category.

**Example:** `/api/products/category/Athletic`

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 3
}
```

### Search Products

**POST** `/api/products/search`

Search products with filters.

**Request Body:**
```json
{
  "query": "nike",
  "minPrice": 50,
  "maxPrice": 150,
  "category": "Athletic"
}
```

**All fields optional**

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 2
}
```

---

## Orders API

### Create Order

**POST** `/api/orders`

Create a new order.

**Request Body:**
```json
{
  "customer_email": "john@example.com",
  "customer_name": "John Doe",
  "shipping_address": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1 555-0100",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001",
    "country": "United States"
  },
  "items": [
    {
      "product_id": 1,
      "product_name": "Nike Drops - Blue",
      "quantity": 2,
      "price": 98.00,
      "size_system": "US",
      "size_value": "10"
    }
  ],
  "subtotal": 196.00,
  "shipping_cost": 0.00,
  "tax": 35.28,
  "total": 231.28,
  "payment_status": "completed",
  "payment_method": "PayPal",
  "paypal_order_id": "ORDER123",
  "paypal_capture_id": "CAPTURE123",
  "status": "processing"
}
```

**Required Fields:**
- `customer_email`
- `items` (array, min 1 item)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "order_number": "GSS-1234567890-ABC123",
    ...
  },
  "message": "Order created successfully"
}
```

### Get All Orders

**GET** `/api/orders`

Get all orders with pagination. (Admin only)

**Query Parameters:**
- `status` (optional) - Filter by status
- `payment_status` (optional) - Filter by payment status
- `limit` (optional, default: 50) - Results per page
- `offset` (optional, default: 0) - Pagination offset

**Example:** `/api/orders?status=processing&limit=10`

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 100,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100
  }
}
```

### Get Order by ID

**GET** `/api/orders/:id`

Get order details by UUID.

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

### Get Order by Order Number

**GET** `/api/orders/number/:orderNumber`

Get order by order number (e.g., GSS-1234567890-ABC123).

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

### Get Customer Orders

**GET** `/api/orders/customer/:email`

Get all orders for a specific customer email.

**Example:** `/api/orders/customer/john@example.com`

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 5
}
```

### Update Order

**PUT** `/api/orders/:id`

Update order details. (Admin only)

**Request Body:**
```json
{
  "status": "shipped",
  "tracking_number": "TRACK123"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Order updated successfully"
}
```

### Update Order Status

**PATCH** `/api/orders/:id/status`

Update only the order status. (Admin only)

**Request Body:**
```json
{
  "status": "delivered"
}
```

**Valid statuses:**
- `pending`
- `processing`
- `shipped`
- `delivered`
- `cancelled`

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Order status updated successfully"
}
```

### Update Payment Status

**PATCH** `/api/orders/:id/payment-status`

Update payment status. (Admin only)

**Request Body:**
```json
{
  "payment_status": "refunded",
  "payment_id": "REFUND123"
}
```

**Valid payment statuses:**
- `pending`
- `completed`
- `failed`
- `refunded`

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Payment status updated successfully"
}
```

### Delete Order

**DELETE** `/api/orders/:id`

Delete an order. (Admin only - use with caution)

**Response:**
```json
{
  "success": true,
  "message": "Order deleted successfully"
}
```

### Get Order Statistics

**GET** `/api/orders/stats/summary`

Get order statistics for admin dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_orders": 150,
    "total_revenue": 15234.50,
    "pending_orders": 5,
    "completed_orders": 140,
    "revenue_by_status": {
      "completed": 14500.00,
      "pending": 734.50
    }
  }
}
```

---

## Contact API

### Submit Contact Form

**POST** `/api/contact`

Submit a contact form message.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about shipping",
  "message": "I have a question about international shipping..."
}
```

**All fields required**

**Validation:**
- `name` - Min 1 character
- `email` - Valid email format
- `subject` - Min 1 character
- `message` - Min 1 character

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question about shipping",
    "message": "...",
    "status": "new",
    "created_at": "2024-12-08T10:30:00Z"
  },
  "message": "Thank you for contacting us. We will get back to you soon."
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "All fields are required"
}
```

### Get All Contact Messages

**GET** `/api/contact`

Get all contact messages. (Admin only)

**Query Parameters:**
- `status` (optional) - Filter by status (new, read, replied, archived)
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Example:** `/api/contact?status=new&limit=20`

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 45,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 45
  }
}
```

### Get Contact Message by ID

**GET** `/api/contact/:id`

Get a single contact message. (Admin only)

**Auto-marks as "read" when viewed**

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question",
    "message": "...",
    "status": "read",
    "created_at": "2024-12-08T10:30:00Z",
    "updated_at": "2024-12-08T10:35:00Z"
  }
}
```

### Update Contact Message Status

**PATCH** `/api/contact/:id/status`

Update message status. (Admin only)

**Request Body:**
```json
{
  "status": "replied"
}
```

**Valid statuses:**
- `new`
- `read`
- `replied`
- `archived`

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Status updated successfully"
}
```

### Delete Contact Message

**DELETE** `/api/contact/:id`

Delete a contact message. (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Contact message deleted successfully"
}
```

### Get Contact Statistics

**GET** `/api/contact/stats/summary`

Get contact message statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "new": 15,
    "read": 30,
    "replied": 50,
    "archived": 5
  }
}
```

---

## PayPal API

### Test Connection

**GET** `/api/paypal/test`

Test PayPal API connection.

**Response:**
```json
{
  "success": true,
  "message": "PayPal connection successful",
  "hasToken": true
}
```

### Create Payment

**POST** `/api/paypal/create-payment`

Create a PayPal payment order.

**Request Body:**
```json
{
  "amount": "231.28",
  "currency": "USD",
  "description": "Order for 2 items",
  "customerInfo": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1 555-0100",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "United States"
  },
  "items": [
    {
      "name": "Nike Drops - Blue",
      "quantity": 2,
      "price": 98.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "PAYPAL_ORDER_ID",
  "links": [
    {
      "href": "https://www.sandbox.paypal.com/checkoutnow?token=...",
      "rel": "approval_url",
      "method": "GET"
    }
  ],
  "status": "CREATED"
}
```

**Usage:**
1. Redirect user to `approval_url`
2. User completes payment on PayPal
3. PayPal redirects back with token
4. Capture payment with token

### Capture Payment

**POST** `/api/paypal/capture-payment/:orderId`

Capture an approved PayPal payment.

**Parameters:**
- `orderId` - PayPal order ID (from create-payment response)

**Response:**
```json
{
  "success": true,
  "captureId": "CAPTURE_ID",
  "status": "COMPLETED",
  "payer": {
    "email_address": "customer@example.com",
    "name": { ... }
  },
  "purchase_units": [ ... ]
}
```

### Get Order Details

**GET** `/api/paypal/order/:orderId`

Get PayPal order details.

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "ORDER_ID",
    "status": "COMPLETED",
    ...
  }
}
```

### Process Refund

**POST** `/api/paypal/refund/:captureId`

Refund a payment.

**Request Body (optional):**
```json
{
  "amount": "50.00",
  "currency": "USD"
}
```

**Omit body for full refund**

**Response:**
```json
{
  "success": true,
  "refundId": "REFUND_ID",
  "status": "COMPLETED"
}
```

### Webhook Handler

**POST** `/api/paypal/webhook`

Handle PayPal webhook notifications.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": { ... }
}
```

**Response:**
```json
{
  "received": true
}
```

**Supported Events:**
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request (validation failed) |
| 404 | Resource not found |
| 500 | Internal server error |

## Rate Limiting

Currently not implemented. Recommended for production:
- 100 requests per 15 minutes per IP
- Higher limits for authenticated users

## Authentication

Currently not implemented. All admin endpoints should be protected with:
- JWT authentication
- Role-based access control (RBAC)
- API keys for external integrations

## CORS

**Allowed Origins:**
- Development: `http://localhost:5173`
- Production: Your frontend domain

**Allowed Methods:**
- GET, POST, PUT, PATCH, DELETE, OPTIONS

**Credentials:** Enabled

## Testing the API

### Using cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Get products
curl http://localhost:5000/api/products

# Create product
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Shoe","price":99.99}'

# Search products
curl -X POST http://localhost:5000/api/products/search \
  -H "Content-Type: application/json" \
  -d '{"query":"nike","minPrice":50}'
```

### Using Postman

1. Import collection (create from this documentation)
2. Set base URL variable
3. Test each endpoint
4. Save responses for reference

### Using JavaScript/Frontend

```javascript
// Example: Get products
const response = await fetch('http://localhost:5000/api/products');
const data = await response.json();
console.log(data);

// Example: Create order
const order = await fetch('http://localhost:5000/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(orderData),
});
```

## Changelog

### Version 1.0.0 (December 2024)

- Initial API release
- Products CRUD operations
- Orders management
- Contact form submission
- PayPal payment integration
- Statistics endpoints

---

**For support:** support@gaultiershoes.com

**Last Updated:** December 2024

