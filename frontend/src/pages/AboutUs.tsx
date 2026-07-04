import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, Award, Truck, Shield, Package, MapPin } from "lucide-react";
import MetaTags from "../components/MetaTags";
import { useResponsive } from "../hooks/useResponsive";
import { FREE_SHIPPING_MESSAGE, SHIPPING_COST } from "../utils/pricing";
import { getWhatsAppContactDisplay } from "../lib/whatsappContact";

export default function AboutUs() {
  const { isMobile } = useResponsive();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)",
      }}
    >
      <MetaTags
        title="About Us — Lab Door Customs"
        description="Learn about Lab Door Customs — custom footwear, craftsmanship, and how we fulfill orders from browse to delivery."
        path="/about"
      />
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
          padding: isMobile ? "60px 20px" : "100px 40px",
          textAlign: "center",
          color: "white",
        }}
      >
        <motion.h1
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          style={{
            fontSize: isMobile ? 36 : 56,
            fontWeight: 900,
            marginBottom: 20,
            letterSpacing: 1,
          }}
        >
          About Lab Door Customs
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: isMobile ? 16 : 20,
            maxWidth: 800,
            margin: "0 auto",
            lineHeight: 1.7,
            opacity: 0.95,
          }}
        >
          Premium custom footwear — browse online, checkout securely, complete payment via WhatsApp,
          and track your order from our workshop to your door.
        </motion.p>
      </motion.div>

      {/* Main Content */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "40px 20px" : "80px 40px",
        }}
      >
        {/* Our Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "white",
            borderRadius: 20,
            padding: isMobile ? 30 : 50,
            marginBottom: 40,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: 800,
              color: "#1f2937",
              marginBottom: 24,
            }}
          >
            Our Story
          </h2>
          <p
            style={{
              fontSize: isMobile ? 15 : 17,
              color: "#4b5563",
              lineHeight: 1.8,
              marginBottom: 20,
            }}
          >
            Lab Door Customs was founded and designed by Shivam Negi, a passionate sneaker enthusiast
            with a sharp eye for detail and originality. Built from a love for beautifully crafted
            custom footwear, the store celebrates unique design, premium comfort, and bold style.
            Every pair is made to help you stand out — whether you are chasing everyday elegance or
            street-ready edge.
          </p>
          <p
            style={{
              fontSize: isMobile ? 15 : 17,
              color: "#4b5563",
              lineHeight: 1.8,
            }}
          >
            Shop our catalog online, select your size, and place your order through checkout. After
            payment is confirmed, we prepare your custom order and keep you updated by email. Track
            any order on{" "}
            <Link to="/orders" style={{ color: "#9c6649", fontWeight: 600 }}>
              My Orders
            </Link>{" "}
            with your order ID and checkout email.
          </p>
        </motion.div>

        {/* Values Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 24,
            marginBottom: 40,
          }}
        >
          {[
            {
              icon: Award,
              title: "Custom Craftsmanship",
              description:
                "Each design reflects attention to materials, fit, and finish — built for people who care about the details.",
              delay: 0.4,
            },
            {
              icon: Heart,
              title: "Customer Support",
              description: `Questions about orders or manufacturing-defect replacements? Message us on WhatsApp at ${getWhatsAppContactDisplay()}.`,
              delay: 0.5,
            },
            {
              icon: Truck,
              title: "Straightforward Shipping",
              description: `$${SHIPPING_COST} standard shipping on all orders. ${FREE_SHIPPING_MESSAGE}.`,
              delay: 0.6,
            },
            {
              icon: Shield,
              title: "Secure Checkout",
              description:
                "Server-validated pricing, CSRF-protected forms, and payment completed via WhatsApp — card details are not stored on our site.",
              delay: 0.7,
            },
            {
              icon: Package,
              title: "Order Tracking",
              description:
                "Look up status, items, and carrier tracking on My Orders after your order ships.",
              delay: 0.8,
            },
            {
              icon: MapPin,
              title: "Clear Store Policies",
              description:
                "All sales are final. Manufacturing-defect replacements within 30 days of delivery — see our Returns and Replacement policies.",
              delay: 0.9,
            },
          ].map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: value.delay }}
              style={{
                background: "white",
                borderRadius: 16,
                padding: isMobile ? 24 : 32,
                textAlign: "center",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1)";
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <value.icon size={28} color="white" />
              </div>
              <h3
                style={{
                  fontSize: isMobile ? 18 : 20,
                  fontWeight: 700,
                  color: "#1f2937",
                  marginBottom: 12,
                }}
              >
                {value.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.6,
                }}
              >
                {value.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          style={{
            background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
            borderRadius: 20,
            padding: isMobile ? 40 : 60,
            textAlign: "center",
            color: "white",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            Ready to Step Up Your Style?
          </h2>
          <p
            style={{
              fontSize: isMobile ? 16 : 18,
              marginBottom: 32,
              opacity: 0.95,
            }}
          >
            Browse the catalog, pick your size, and checkout when you are ready.
          </p>
          <Link
            to="/products"
            style={{
              display: "inline-block",
              padding: isMobile ? "14px 32px" : "16px 40px",
              background: "white",
              color: "#9c6649",
              borderRadius: 12,
              fontSize: isMobile ? 16 : 18,
              fontWeight: 700,
              textDecoration: "none",
              transition: "transform 0.2s, box-shadow 0.2s",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1)";
            }}
          >
            Shop Products
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
