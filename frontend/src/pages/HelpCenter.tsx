import React, { useState } from "react";
import { Package, Shield, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";

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
                    Shipping Methods & Times
                  </h4>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li><strong>Standard Shipping:</strong> 5-7 business days ($5.99)</li>
                    <li><strong>Express Shipping:</strong> 2-3 business days ($12.99)</li>
                    <li><strong>Overnight Shipping:</strong> 1 business day ($24.99)</li>
                    <li><strong>Free Shipping:</strong> Orders over $100 qualify for free standard shipping</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>
                    Order Tracking
                  </h4>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    Once your order ships, you'll receive a confirmation email with a tracking number. 
                    You can track your package using this number on our website or the carrier's website.
                  </p>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    Tracking information typically updates within 24 hours of shipment. If you haven't 
                    received tracking information within 2 business days of placing your order, please 
                    contact our customer support team.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#4b5563" }}>
                    International Shipping
                  </h4>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    We ship to most countries worldwide. International shipping times vary by destination 
                    (typically 7-14 business days). Customers are responsible for any customs fees, duties, 
                    or taxes imposed by their country.
                  </p>
                </div>

                <div style={{ 
                  padding: 16, 
                  background: "#f9fafb", 
                  borderRadius: 10,
                  borderLeft: "4px solid #9c6649"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: 14 }}>
                    <strong>Note:</strong> Shipping times are estimates and may vary due to weather, 
                    holidays, or other unforeseen circumstances.
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
                  Last Updated: {new Date().toLocaleDateString()}
                </p>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Information We Collect
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    We collect information you provide directly to us when you:
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Create an account or make a purchase</li>
                    <li>Subscribe to our newsletter</li>
                    <li>Contact customer support</li>
                    <li>Participate in surveys or promotions</li>
                  </ul>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginTop: 12 }}>
                    This may include your name, email address, shipping address, phone number, 
                    and payment information.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    How We Use Your Information
                  </h3>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Process and fulfill your orders</li>
                    <li>Send order confirmations and shipping updates</li>
                    <li>Respond to your questions and requests</li>
                    <li>Send promotional emails (with your consent)</li>
                    <li>Improve our products and services</li>
                    <li>Detect and prevent fraud</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Information Sharing
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    We do not sell or rent your personal information to third parties. We may share 
                    your information with service providers who help us operate our business (e.g., 
                    payment processors, shipping companies) under strict confidentiality agreements.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Data Security
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    We use industry-standard security measures to protect your information, including 
                    encryption, secure servers, and regular security audits. However, no method of 
                    transmission over the internet is 100% secure.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Your Rights
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    You have the right to:
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Access and review your personal information</li>
                    <li>Request corrections to inaccurate data</li>
                    <li>Request deletion of your data (subject to legal requirements)</li>
                    <li>Opt-out of marketing communications at any time</li>
                  </ul>
                </div>

                <div style={{ 
                  padding: 16, 
                  background: "#f9fafb", 
                  borderRadius: 10,
                  borderLeft: "4px solid #9c6649"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: 14 }}>
                    For privacy-related questions or to exercise your rights, contact us at 
                    privacy@gaultiershoes.com
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
                  Last Updated: {new Date().toLocaleDateString()}
                </p>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Acceptance of Terms
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    By accessing and using Lab Door Customs' website and services, you agree to be 
                    bound by these Terms and Conditions. If you do not agree with any part of these terms, 
                    you may not use our services.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Product Information & Pricing
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    We strive to provide accurate product descriptions and pricing. However:
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>Colors may vary slightly due to monitor settings</li>
                    <li>Prices are subject to change without notice</li>
                    <li>We reserve the right to limit quantities</li>
                    <li>We reserve the right to refuse any order</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Returns & Refunds
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280", marginBottom: 12 }}>
                    We want you to be completely satisfied with your purchase:
                  </p>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#6b7280" }}>
                    <li>30-day return policy for unworn items in original packaging</li>
                    <li>Returns must include all original tags and documentation</li>
                    <li>Refunds processed within 5-7 business days of receiving return</li>
                    <li>Shipping costs are non-refundable (unless item is defective)</li>
                    <li>Sale items are final sale unless defective</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Account Responsibilities
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    If you create an account with us, you are responsible for maintaining the 
                    confidentiality of your account information and password. You agree to accept 
                    responsibility for all activities that occur under your account.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Intellectual Property
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    All content on this website, including text, graphics, logos, images, and software, 
                    is the property of Lab Door Customs and is protected by copyright and trademark laws. 
                    Unauthorized use is prohibited.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Limitation of Liability
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    Lab Door Customs shall not be liable for any indirect, incidental, special, or 
                    consequential damages arising from your use of our website or products. Our total 
                    liability shall not exceed the amount you paid for the product in question.
                  </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937" }}>
                    Governing Law
                  </h3>
                  <p style={{ lineHeight: 1.8, color: "#6b7280" }}>
                    These Terms and Conditions are governed by and construed in accordance with the laws 
                    of the State of New York, United States, without regard to its conflict of law provisions.
                  </p>
                </div>

                <div style={{ 
                  padding: 16, 
                  background: "#f9fafb", 
                  borderRadius: 10,
                  borderLeft: "4px solid #9c6649"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: 14 }}>
                    For questions about these Terms & Conditions, contact us at legal@gaultiershoes.com
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

