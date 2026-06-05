import React, { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import MetaTags from "../components/MetaTags";
import { logError } from "../lib/logger";
import { apiFetch } from "../config";
import { useResponsive } from "../hooks/useResponsive";

export default function ContactUs() {
  const { isMobile } = useResponsive();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    try {
      const response = await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        toast.success(data.message || 'Message sent successfully!', {
          description: "We'll get back to you as soon as possible.",
          duration: 5000,
        });
        setTimeout(() => {
          setSubmitted(false);
          setFormData({ name: "", email: "", subject: "", message: "" });
        }, 3000);
      } else {
        toast.error(data.error || 'Failed to send message', {
          description: data.message || 'Please try again or contact us directly.',
          duration: 6000,
        });
      }
    } catch (error) {
      logError('Error submitting contact form:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast.error('Network error', {
          description: 'Please check your internet connection and try again.',
          duration: 6000,
        });
      } else {
        toast.error('Failed to send message', {
          description: 'An unexpected error occurred. Please try again later.',
          duration: 6000,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
      padding: isMobile ? "40px 20px" : "60px 40px",
      paddingBottom: isMobile ? "max(40px, env(safe-area-inset-bottom))" : "40px"
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
        padding: isMobile ? 30 : 50,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <h1 style={{
            fontSize: isMobile ? 36 : 48,
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
                  <Mail size={24} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                    Email
                  </h3>
                  <p style={{ color: "#6b7280", margin: 0 }}>support@gaultiershoes.com</p>
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
                  <Phone size={24} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                    Phone
                  </h3>
                  <p style={{ color: "#6b7280", margin: 0 }}>+1 (555) 123-4567</p>
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
                    123 Fashion Avenue<br />
                    New York, NY 10001<br />
                    United States
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
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Your Name
                </label>
                <input
                  type="text"
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
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Email Address
                </label>
                <input
                  type="email"
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
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Subject
                </label>
                <input
                  type="text"
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
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Message
                </label>
                <textarea
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
                  ✓ Message sent successfully! We'll get back to you soon.
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
                {isSubmitting ? "Sending..." : (submitted ? "Sent!" : "Send Message")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

