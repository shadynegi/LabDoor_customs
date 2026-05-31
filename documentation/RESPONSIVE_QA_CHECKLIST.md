# Responsive QA Checklist

Manual QA for responsive layouts across the Lab Door Customs storefront and admin dashboard.

**Full reference:** [`../info.md`](../info.md)

---

## Breakpoints to test

| Device | Width | Priority pages |
|--------|-------|----------------|
| Mobile | 375px | Home, products, product detail, cart, checkout |
| Tablet | 768px | Products (filters), checkout, admin dashboard |
| Desktop | 1280px+ | All pages, admin dashboard tabs |

---

## Storefront checks

### Home (`/`)

- [ ] Hero carousel renders and swipes on mobile
- [ ] Product search bar usable on small screens
- [ ] Navigation menu accessible

### Products (`/products`)

- [ ] Filter panel usable on mobile (collapse/expand)
- [ ] Product grid reflows (1 col mobile, 2–3 col desktop)
- [ ] Search results display correctly

### Product detail (`/product/:id`)

- [ ] 360° viewer works on touch devices
- [ ] Add to cart button visible without excessive scroll
- [ ] Reviews section readable

### Cart and checkout

- [ ] Cart items stack vertically on mobile
- [ ] Checkout form fields full-width on mobile
- [ ] PayPal button accessible

### Policies and contact

- [ ] Text readable without horizontal scroll
- [ ] Contact form submits successfully

---

## Admin dashboard

- [ ] Login form centered on all sizes
- [ ] Dashboard tabs scroll or stack on mobile
- [ ] Data tables horizontally scrollable on small screens
- [ ] Modals fit within viewport

---

## Cross-cutting

- [ ] No horizontal overflow on any page
- [ ] Touch targets at least 44×44px
- [ ] Images scale without distortion
- [ ] Toast notifications (Sonner) visible on mobile
