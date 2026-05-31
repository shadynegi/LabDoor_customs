# Shopping Cart

How the cart works in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

## Storage

- Cart persisted in browser `localStorage` under app-specific key
- Survives page refresh; cleared after successful payment capture

## Behavior

- Add/remove/update quantities on product pages and cart page
- Stock validated server-side at checkout (create-payment)
- Server rejects checkout if items out of stock or quantities exceed inventory

## Clear cart manually

Open browser DevTools → Application → Local Storage → delete cart key, or use cart page remove-all if available.
