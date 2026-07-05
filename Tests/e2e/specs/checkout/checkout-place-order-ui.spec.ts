import { test, expect } from '../../fixtures/storefront';
import { seedCart } from '../../helpers/ui';
import { PRIMARY_MOCK_PRODUCT } from '../../fixtures/mock-data';
import {
  clickPlaceOrderAndWaitForResponse,
  fillCheckoutCustomerForm,
} from '../../helpers/checkout';

test.describe('Checkout WhatsApp place-order', () => {
  test('place order returns whatsappUrl after policy acceptance and form completion', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const product = PRIMARY_MOCK_PRODUCT;
    await seedCart(page, [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      },
    ]);

    await page.goto('/checkout');
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('checkbox', { name: /all sales are final/i }).check();
    await fillCheckoutCustomerForm(page);

    const { body } = await clickPlaceOrderAndWaitForResponse(page);
    expect(body.success).toBe(true);
    expect(body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/919888514572\?text=/);
    expect(body.orderNumber).toBe('GSS-CHECKOUT-TEST');
  });
});
