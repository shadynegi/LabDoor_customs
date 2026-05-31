# Server-Side Pricing

How pricing is calculated and validated.

**Full reference:** [`../info.md`](../info.md)

## Rules

- All prices computed server-side at create-payment
- Client-submitted totals validated against server calculation
- Mismatch rejects checkout before PayPal redirect
- Coupon discounts applied server-side with scope validation (product/category/global)
- Currency: USD, two decimal places
