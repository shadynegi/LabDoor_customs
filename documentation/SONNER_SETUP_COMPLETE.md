# Toast Notifications

Sonner toast notification usage in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

## Usage

- `<Toaster />` mounted in app root
- Success/error/info toasts on form submit, cart actions, checkout
- Admin dashboard uses toasts for CRUD feedback

## Patterns

```typescript
import { toast } from 'sonner';
toast.success('Order updated');
toast.error('Failed to save product');
```
