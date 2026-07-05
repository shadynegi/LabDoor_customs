import React, { useState } from "react";
import { MessageCircle, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import MetaTags from "../components/MetaTags";
import { trackContactSubmit } from "../utils/activityTracker";
import { useResponsive } from "../hooks/useResponsive";
import {
  buildWhatsAppContactUrl,
  formatContactFormWhatsAppMessage,
  getWhatsAppContactDisplay,
  validateContactForm,
} from "../lib/whatsappContact";
import { safeHorizontalPad } from "../lib/responsive";

const EMPTY_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export default function ContactUs() {
  const { isMobile, isSmallMobile } = useResponsive();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submitted) return;

    const validation = validateContactForm(formData);
    if (!validation.ok) {
      toast.error(validation.error, {
        description: validation.description,
        duration: 6000,
      });
      return;
    }

    const whatsappUrl = buildWhatsAppContactUrl(
      formatContactFormWhatsAppMessage(validation.data),
    );
    if (whatsappUrl === '#') {
      toast.error('WhatsApp contact is not configured', {
        description: 'Please try again later or use the WhatsApp link in the sidebar.',
        duration: 6000,
      });
      return;
    }

    setIsSubmitting(true);
    trackContactSubmit(validation.data.subject);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
    toast.success('Opening WhatsApp…', {
      description: "Send the pre-filled message to reach us. We'll respond as soon as possible.",
      duration: 5000,
    });
    setTimeout(() => {
      setSubmitted(false);
      setFormData(EMPTY_FORM);
      setIsSubmitting(false);
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div style={{ 
      minHeight: "100dvh",
      background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
      padding: isMobile ? `${isSmallMobile ? 24 : 32}px 0` : "60px 0",
      paddingBottom: isMobile ? "max(32px, env(safe-area-inset-bottom))" : "60px",
      ...safeHorizontalPad(),
    }}>
      <MetaTags
        title="Contact Us — Lab Door Customs"
        description="Get in touch with Lab Door Customs for orders, custom requests, and support."
        path="/contact"
      />
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        background: "white",
        borderRadius: 20,
        padding: isMobile ? (isSmallMobile ? 20 : 24) : 50,
        boxSizing: "border-box",
        width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <h1 style={{
            fontSize: isSmallMobile ? 28 : (isMobile ? 32 : 48),
            fontWeight: 900,
            background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 16
          }}>
            Contact Us
          </h1>
          <p style={{ color: "#6b7280", fontSize: isMobile ? 14 : 16 }}>
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 40 : 60,
        }}>
          {/* Contact Information */}
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#1f2937" }}>
              Get In Touch
            </h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                  padding: 12,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <MessageCircle size={24} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                    WhatsApp
                  </h3>
                  <a
                    href={buildWhatsAppContactUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#9c6649", margin: 0, fontWeight: 600, textDecoration: "none" }}
                    data-testid="contact-support-whatsapp"
                  >
                    {getWhatsAppContactDisplay()}
                  </a>
                  <p style={{ color: "#6b7280", margin: "8px 0 0", fontSize: 14 }}>
                    Chat with us for orders, support, and custom requests.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                  padding: 12,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <MapPin size={24} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                    Address
                  </h3>
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    415, Sector 78<br />
                    Mohali, Punjab<br />
                    India<br />
                    140308
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 40,
              padding: 20,
              background: "#f9fafb",
              borderRadius: 12,
              borderLeft: "4px solid #9c6649"
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Business Hours
              </h3>
              <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>
                Monday - Friday: 9:00 AM - 6:00 PM<br />
                Saturday: 10:00 AM - 4:00 PM<br />
                Sunday: Closed
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#1f2937" }}>
              Send a Message
            </h2>
            
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label htmlFor="contact-name" style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Your Name
                </label>
                <input
                  type="text"
                  id="contact-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    transition: "all 0.2s",
                    outline: "none"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#9c6649"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
                />
              </div>

              <div>
                <label htmlFor="contact-email" style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="contact-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    transition: "all 0.2s",
                    outline: "none"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#9c6649"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
                />
              </div>

              <div>
                <label htmlFor="contact-subject" style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Subject
                </label>
                <input
                  type="text"
                  id="contact-subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    transition: "all 0.2s",
                    outline: "none"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#9c6649"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
                />
              </div>

              <div>
                <label htmlFor="contact-message" style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    transition: "all 0.2s",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#9c6649"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
                />
              </div>

              {submitted && (
                <div style={{
                  padding: "12px 16px",
                  background: "#d1fae5",
                  borderRadius: 10,
                  color: "#065f46",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "center"
                }}>
                  ✓ WhatsApp opened with your message. Send it there to reach us.
                </div>
              )}

              <button
                type="submit"
                disabled={submitted || isSubmitting}
                style={{
                  background: (submitted || isSubmitting) ? "#9ca3af" : "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                  color: "white",
                  padding: "14px 24px",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: (submitted || isSubmitting) ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  if (!submitted && !isSubmitting) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(102,126,234,0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitted && !isSubmitting) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <Send size={18} />
                {isSubmitting ? "Opening WhatsApp…" : (submitted ? "Sent!" : "Send Message")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
