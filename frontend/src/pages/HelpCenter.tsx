import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, Shield, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";
import {
  FREE_SHIPPING_MESSAGE,
  SHIPPING_COST,
} from "../utils/pricing";
import { REPLACEMENT_SUPPORT_EMAIL } from "../constants/returnPolicy";
import { SITE_EMAILS } from "../lib/site";

type Section = "shipping" | "privacy" | "terms";

export default function HelpCenter() {
  const { isMobile } = useResponsive();
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  const toggleSection = (section: Section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)",
      padding: isMobile ? "40px 20px" : "60px 40px",
      paddingBottom: isMobile ? "max(40px, env(safe-area-inset-bottom))" : "40px"
    }}>
      <div style={{
        maxWidth: 1000,
        margin: "0 auto",
      }}>
        {/* Header */}
        <div style={{ 
          textAlign: "center", 
          marginBottom: 50,
          color: "white"
        }}>
          <h1 style={{
            fontSize: isMobile ? 36 : 48,
            fontWeight: 900,
            marginBottom: 16,
            textShadow: "0 4px 20px rgba(0,0,0,0.2)"
          }}>
            Help Center
          </h1>
          <p style={{ fontSize: isMobile ? 14 : 16, opacity: 0.95 }}>
            Find answers to common questions and learn more about our policies
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Shipping & Tracking */}
          <div style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <button
              onClick={() => toggleSection("shipping")}
              style={{
                width: "100%",
                padding: isMobile ? "20px" : "24px 32px",
                background: activeSection === "shipping" 
                  ? "linear-gradient(135deg, #361906 0%, #9c6649 100%)" 
                  : "white",
                color: activeSection === "shipping" ? "white" : "#1f2937",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 0.3s",
                fontSize: isMobile ? 18 : 20,
                fontWeight: 700
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Package size={24} />
                Shipping & Tracking
              </div>
              {activeSection === "shipping" ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </button>
            
            {activeSection === "shipping" && (
              <div style={{ padding: isMobile ? "20px" : "32px", color: "#374151" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>
                  Shipping Information
                </h3>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>
                    Shipping rates
                  </h4>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>
                      <strong>Standard shipping:</strong> ${SHIPPING_COST} flat rate on all orders
                    </li>
                    <li>
                      <strong>Free shipping:</strong> {FREE_SHIPPING_MESSAGE}
                    </li>
                  </ul>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginTop: 12, marginBottom: 0 }}>
                    Shipping is calculated at checkout from your cart subtotal (before volume or coupon
                    discounts). Cart and checkout show the exact shipping charge before you place your order.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>
                    Processing & delivery
                  </h4>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    After you complete checkout, our team confirms payment and prepares your custom order for
                    shipment. You will receive email updates when your order status changes.
                  </p>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", margin: 0 }}>
                    Delivery times depend on your location and carrier service once the package ships. Estimated
                    delivery dates may appear on your order when available.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>
                    Order tracking
                  </h4>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    Track your order anytime on the{" "}
                    <Link to="/orders" style={{ color: "#9c6649", fontWeight: 600 }}>
                      My Orders
                    </Link>{" "}
                    page with your <strong>order ID</strong> (UUID from your confirmation email or WhatsApp
                    message) and the <strong>email address used at checkout</strong>.
                  </p>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    Order confirmation and shipping notification emails include a link that pre-fills your order
                    ID — enter your checkout email and click <strong>Search</strong> to view status, items, and
                    tracking details.
                  </p>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", margin: 0 }}>
                    When your order ships, tracking number and carrier information appear on My Orders. If you
                    shipped but do not see tracking within a few days, contact us with your order ID.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>
                    Shipping address
                  </h4>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", margin: 0 }}>
                    Enter your full shipping address at checkout. We ship to the address you provide; please
                    double-check it before placing your order. For questions about a specific destination,
                    contact our support team.
                  </p>
                </div>

                <div style={{
                  padding: 16,
                  background: "#f9fafb",
                  borderRadius: 10,
                  borderLeft: "4px solid #9c6649"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: 14, lineHeight: 1.7 }}>
                    <strong>Note:</strong> Shipping times are estimates and may vary due to production,
                    carrier delays, weather, or holidays. See our{" "}
                    <Link to="/shipping-policy" style={{ color: "#9c6649", fontWeight: 600 }}>
                      Shipping Policy
                    </Link>{" "}
                    for full details.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Privacy Policy */}
          <div style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <button
              onClick={() => toggleSection("privacy")}
              style={{
                width: "100%",
                padding: isMobile ? "20px" : "24px 32px",
                background: activeSection === "privacy" 
                  ? "linear-gradient(135deg, #361906 0%, #9c6649 100%)" 
                  : "white",
                color: activeSection === "privacy" ? "white" : "#1f2937",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 0.3s",
                fontSize: isMobile ? 18 : 20,
                fontWeight: 700
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Shield size={24} />
                Privacy Policy
              </div>
              {activeSection === "privacy" ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </button>
            
            {activeSection === "privacy" && (
              <div style={{ padding: isMobile ? "20px" : "32px", color: "#374151" }}>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24, fontStyle: "italic" }}>
                  Summary — see our full{" "}
                  <Link to="/privacy-policy" style={{ color: "#9c6649", fontWeight: 600 }}>
                    Privacy Policy
                  </Link>{" "}
                  for complete details.
                </p>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Information we collect
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    We collect information you provide when you:
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Place an order (name, email, phone, shipping address, cart items, size selections)</li>
                    <li>Look up an order on My Orders (order ID and checkout email)</li>
                    <li>Submit the contact form or a product review</li>
                    <li>Accept optional analytics cookies (page views and storefront actions, when consented)</li>
                  </ul>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginTop: 12, marginBottom: 0 }}>
                    Checkout completes payment via WhatsApp — we do not store card numbers on this website.
                    Order and cart data may be saved in your browser (localStorage / sessionStorage) for convenience.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    How we use your information
                  </h3>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Process and fulfill orders (pricing validation, inventory, shipping)</li>
                    <li>Send order confirmation and shipping emails (via Resend)</li>
                    <li>Respond to contact messages and support requests</li>
                    <li>Moderate product reviews</li>
                    <li>Improve the storefront when analytics consent is granted</li>
                    <li>Protect against fraud and abuse (rate limits, CSRF)</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Information sharing
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", margin: 0 }}>
                    We do not sell your personal information. We share data only with service providers
                    that help us operate the store (email delivery, hosting, database, WhatsApp messaging
                    when configured) under confidentiality obligations.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Data security & your rights
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    We use industry-standard protections including HTTPS, HttpOnly admin sessions, and
                    server-side validation. You may request access, correction, or deletion of your data
                    where applicable, and you can reject non-essential cookies via the cookie banner.
                  </p>
                </div>

                <div style={{
                  padding: 16,
                  background: "#f9fafb",
                  borderRadius: 10,
                  borderLeft: "4px solid #9c6649"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: 14, lineHeight: 1.7 }}>
                    For privacy-related questions or to exercise your rights, contact{" "}
                    <a href={`mailto:${SITE_EMAILS.privacy}`} style={{ color: "#9c6649", fontWeight: 600 }}>
                      {SITE_EMAILS.privacy}
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Terms & Conditions */}
          <div style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}>
            <button
              onClick={() => toggleSection("terms")}
              style={{
                width: "100%",
                padding: isMobile ? "20px" : "24px 32px",
                background: activeSection === "terms" 
                  ? "linear-gradient(135deg, #361906 0%, #9c6649 100%)" 
                  : "white",
                color: activeSection === "terms" ? "white" : "#1f2937",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 0.3s",
                fontSize: isMobile ? 18 : 20,
                fontWeight: 700
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={24} />
                Terms & Conditions
              </div>
              {activeSection === "terms" ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </button>
            
            {activeSection === "terms" && (
              <div style={{ padding: isMobile ? "20px" : "32px", color: "#374151" }}>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24, fontStyle: "italic" }}>
                  Summary — see our full{" "}
                  <Link to="/terms-of-service" style={{ color: "#9c6649", fontWeight: 600 }}>
                    Terms of Service
                  </Link>{" "}
                  for complete details.
                </p>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Acceptance of terms
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    By using Lab Door Customs (browsing, checkout, or order lookup), you agree to these
                    terms and our store policies. If you do not agree, please do not use the site.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Orders & pricing
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    Product prices, shipping (${SHIPPING_COST} standard; {FREE_SHIPPING_MESSAGE.toLowerCase()}),
                    volume discounts (10% off 2+ items, 20% off 5+ items), and coupons are calculated on
                    the server at checkout. You must select a size before adding to cart. Placing an order
                    opens WhatsApp to complete payment — your order stays pending until our team confirms
                    payment.
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Colors and images may vary slightly from your screen</li>
                    <li>We may limit quantities or refuse orders at our discretion</li>
                    <li>Server totals must match checkout before the order is saved</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    No refund & replacement policy
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    <strong>All sales are final.</strong> We do not offer refunds or returns for fit, size,
                    color, or change of mind. Checkout requires accepting this policy.
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Replacements are available only for verified manufacturing defects</li>
                    <li>Contact {REPLACEMENT_SUPPORT_EMAIL} within 30 days of delivery with your order ID and photos</li>
                    <li>Approved replacements ship the same item when stock is available</li>
                    <li>
                      See the full{" "}
                      <Link to="/returns-policy" style={{ color: "#9c6649", fontWeight: 600 }}>
                        Replacement Policy
                      </Link>
                    </li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Intellectual property
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    Site content, logos, and product imagery are owned by Lab Door Customs and may not be
                    used without permission.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Limitation of liability
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    Lab Door Customs is not liable for indirect or consequential damages from use of the
                    site or products. Our liability is limited to the amount you paid for the product in
                    question, to the extent permitted by law.
                  </p>
                </div>

                <div style={{
                  padding: 16,
                  background: "#f9fafb",
                  borderRadius: 10,
                  borderLeft: "4px solid #9c6649"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: 14, lineHeight: 1.7 }}>
                    For questions about these terms, contact{" "}
                    <a href={`mailto:${SITE_EMAILS.legal}`} style={{ color: "#9c6649", fontWeight: 600 }}>
                      {SITE_EMAILS.legal}
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

