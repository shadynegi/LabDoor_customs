import { Resend } from 'resend';
import { withRetry } from './db';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResendEmail(payload: Parameters<typeof resend.emails.send>[0]) {
  return withRetry(
    () => resend.emails.send(payload),
    { retries: 2, baseMs: 200 }
  );
}

interface OrderItem {
  product_name: string;
  product_image?: string; // Product image URL
  quantity: number;
  price: number;
  size_value?: string;
  size_system?: string;
}

interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  shippingAddress: {
    full_name?: string;
    fullName?: string;
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    zip_code?: string;
    country: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  orderDate?: string;
}

// Base URL for product images (fallback for relative paths)
const getProductImageUrl = (image: string | undefined): string => {
  if (!image) {
    return 'https://via.placeholder.com/100x100?text=Product';
  }
  // If it's already an absolute URL, return as is
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  // For relative paths, use a placeholder or your CDN URL
  return `https://via.placeholder.com/100x100?text=Product`;
};

export class EmailService {
  private senderEmail: string;
  private companyName: string;
  private supportEmail: string;

  constructor() {
    this.senderEmail = process.env.SENDER_EMAIL || 'orders@labdoorcustoms.com';
    this.companyName = process.env.COMPANY_NAME || 'Lab Door Customs';
    this.supportEmail = process.env.COMPANY_SUPPORT_EMAIL || 'support@labdoorcustoms.com';
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(data: OrderEmailData) {
    try {
      const emailHtml = this.generateOrderConfirmationHTML(data);
      
      const { data: emailData, error } = await sendResendEmail({
        from: `${this.companyName} <${this.senderEmail}>`,
        to: data.customerEmail,
        subject: `Order Confirmation - ${data.orderNumber}`,
        html: emailHtml,
      });

      if (error) {
        console.error('❌ Failed to send order confirmation:', error);
        return { success: false, error };
      }

      console.log('✅ Order confirmation email sent:', emailData);
      return { success: true, messageId: emailData?.id };
    } catch (error) {
      console.error('❌ Failed to send order confirmation:', error);
      return { success: false, error };
    }
  }

  /**
   * Send shipping notification email
   */
  async sendShippingNotification(data: OrderEmailData) {
    try {
      const emailHtml = this.generateShippingNotificationHTML(data);
      
      const { data: emailData, error } = await sendResendEmail({
        from: `${this.companyName} <${this.senderEmail}>`,
        to: data.customerEmail,
        subject: `Your Order Has Shipped - ${data.orderNumber}`,
        html: emailHtml,
      });

      if (error) {
        console.error('❌ Failed to send shipping notification:', error);
        return { success: false, error };
      }

      console.log('✅ Shipping notification email sent:', emailData);
      return { success: true, messageId: emailData?.id };
    } catch (error) {
      console.error('❌ Failed to send shipping notification:', error);
      return { success: false, error };
    }
  }

  /**
   * Send contact form auto-reply
   */
  async sendContactFormReply(name: string, email: string, subject: string) {
    try {
      const emailHtml = this.generateContactReplyHTML(name, subject);
      
      const { data: emailData, error } = await sendResendEmail({
        from: `${this.companyName} <${this.senderEmail}>`,
        to: email,
        subject: `We received your message - ${subject}`,
        html: emailHtml,
      });

      if (error) {
        console.error('❌ Failed to send contact reply:', error);
        return { success: false, error };
      }

      console.log('✅ Contact form reply sent:', emailData);
      return { success: true, messageId: emailData?.id };
    } catch (error) {
      console.error('❌ Failed to send contact reply:', error);
      return { success: false, error };
    }
  }

  /**
   * Generate order confirmation HTML with product images
   */
  private generateOrderConfirmationHTML(data: OrderEmailData): string {
    const itemsHTML = data.items.map(item => `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; width: 80px; vertical-align: top;">
          <img 
            src="${getProductImageUrl(item.product_image)}" 
            alt="${item.product_name}"
            width="70"
            height="70"
            style="border-radius: 8px; object-fit: cover; background-color: #f3f4f6;"
          />
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <strong style="font-size: 16px; color: #1f2937; display: block; margin-bottom: 6px;">
            ${item.product_name}
          </strong>
          <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">
            Quantity: ${item.quantity}
          </span>
          ${item.size_value ? `
          <span style="color: #6b7280; font-size: 14px; display: block;">
            Size: ${item.size_system} ${item.size_value}
          </span>
          ` : ''}
          <span style="color: #667eea; font-size: 14px; font-weight: 600; display: block; margin-top: 6px;">
            $${item.price.toFixed(2)} each
          </span>
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top;">
          <strong style="font-size: 18px; color: #1f2937;">
            $${(item.price * item.quantity).toFixed(2)}
          </strong>
        </td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800;">
        ${this.companyName}
      </h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
        Order Confirmation
      </p>
    </div>

    <!-- Success Message -->
    <div style="padding: 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <div style="width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px; font-weight: 700;">
        Thank You for Your Order!
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px;">
        Hi ${data.customerName}, we've received your order and will process it shortly.
      </p>
    </div>

    <!-- Order Details -->
    <div style="padding: 30px 20px;">
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
          Order Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Order Number:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">${data.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Order Date:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">${new Date().toLocaleDateString()}</td>
          </tr>
          ${data.estimatedDelivery ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Estimated Delivery:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">${new Date(data.estimatedDelivery).toLocaleDateString()}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Order Items -->
      <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
        Order Items
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        ${itemsHTML}
      </table>

      <!-- Order Summary -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
          Order Summary
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Subtotal:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">$${data.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Shipping:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">$${data.shipping_cost.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Tax:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">$${data.tax.toFixed(2)}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0; color: #1f2937; font-size: 18px; font-weight: 700;">Total:</td>
            <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: 800; color: #10b981;">$${data.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <!-- Shipping Address -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
          Shipping Address
        </h3>
        <p style="margin: 0; color: #6b7280; line-height: 1.8;">
          ${data.shippingAddress.address}<br>
          ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}<br>
          ${data.shippingAddress.country}
        </p>
      </div>

      ${data.trackingNumber ? `
      <!-- Tracking Info -->
      <div style="background-color: #ede9fe; border-radius: 8px; padding: 20px; margin-bottom: 30px; border: 2px solid #8b5cf6;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
          🚚 Tracking Information
        </h3>
        <p style="margin: 0 0 10px 0; color: #6b7280;">
          Tracking Number: <strong style="color: #1f2937; font-family: monospace;">${data.trackingNumber}</strong>
        </p>
        ${data.trackingUrl ? `
        <a href="${data.trackingUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 10px;">
          Track Your Order
        </a>
        ` : ''}
      </div>
      ` : ''}

      <!-- Track Order Link -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:5173/my-orders" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Order Status
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #667eea; text-decoration: none;">${this.supportEmail}</a>
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} ${this.companyName}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate shipping notification HTML
   */
  private generateShippingNotificationHTML(data: OrderEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Has Shipped</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800;">
        ${this.companyName}
      </h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
        Your Order Has Shipped! 🚚
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 20px;">
      <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 24px; font-weight: 700;">
        Hi ${data.customerName}!
      </h2>
      <p style="color: #6b7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.8;">
        Great news! Your order <strong>${data.orderNumber}</strong> has been shipped and is on its way to you.
      </p>

      <!-- Tracking Info -->
      <div style="background-color: #ede9fe; border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 2px solid #8b5cf6;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
          📦 Tracking Information
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Tracking Number:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937; font-family: monospace;">${data.trackingNumber}</td>
          </tr>
          ${data.estimatedDelivery ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Estimated Delivery:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">${new Date(data.estimatedDelivery).toLocaleDateString()}</td>
          </tr>
          ` : ''}
        </table>
        ${data.trackingUrl ? `
        <a href="${data.trackingUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Track Your Package
        </a>
        ` : ''}
      </div>

      <!-- Order Items Summary with Images -->
      <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
        Items in This Shipment
      </h3>
      <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 30px;">
        ${data.items.map(item => `
          <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <img 
              src="${getProductImageUrl(item.product_image)}" 
              alt="${item.product_name}"
              width="60"
              height="60"
              style="border-radius: 8px; object-fit: cover; background-color: #ffffff; margin-right: 16px;"
            />
            <div style="flex: 1;">
              <strong style="font-size: 15px; color: #1f2937; display: block; margin-bottom: 4px;">
                ${item.product_name}
              </strong>
              <span style="color: #6b7280; font-size: 13px;">
                Qty: ${item.quantity}${item.size_value ? ` • Size: ${item.size_system} ${item.size_value}` : ''}
              </span>
            </div>
            <div style="text-align: right;">
              <strong style="font-size: 16px; color: #1f2937;">$${(item.price * item.quantity).toFixed(2)}</strong>
            </div>
          </div>
        `).join('')}
        
        <!-- Order Total in Shipment -->
        <div style="display: flex; justify-content: space-between; padding: 16px 0 0 0; margin-top: 8px; border-top: 2px solid #e5e7eb;">
          <strong style="font-size: 16px; color: #1f2937;">Order Total:</strong>
          <strong style="font-size: 20px; color: #10b981;">$${data.total.toFixed(2)}</strong>
        </div>
      </div>

      <p style="color: #6b7280; font-size: 14px; line-height: 1.8;">
        Your package should arrive by <strong>${data.estimatedDelivery ? new Date(data.estimatedDelivery).toLocaleDateString() : 'the estimated date'}</strong>. You can track your shipment using the link above.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        Questions? Contact us at <a href="mailto:${this.supportEmail}" style="color: #8b5cf6; text-decoration: none;">${this.supportEmail}</a>
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} ${this.companyName}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate contact form reply HTML
   */
  private generateContactReplyHTML(name: string, subject: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Received Your Message</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800;">
        ${this.companyName}
      </h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 20px;">
      <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 24px; font-weight: 700;">
        Thank You for Contacting Us!
      </h2>
      <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 16px; line-height: 1.8;">
        Hi ${name},
      </p>
      <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 16px; line-height: 1.8;">
        We've received your message regarding "<strong>${subject}</strong>" and our team will review it shortly.
      </p>
      <p style="color: #6b7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.8;">
        We typically respond within 24-48 hours during business days. If your inquiry is urgent, please call us directly.
      </p>
      
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; border-left: 4px solid #667eea;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          <strong>What happens next?</strong><br>
          Our support team will review your message and get back to you via email as soon as possible.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        Need immediate assistance? Email us at <a href="mailto:${this.supportEmail}" style="color: #667eea; text-decoration: none;">${this.supportEmail}</a>
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} ${this.companyName}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

// Export singleton instance
export const emailService = new EmailService();