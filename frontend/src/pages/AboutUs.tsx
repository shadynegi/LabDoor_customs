import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Award, Truck, Shield, Users, MapPin } from "lucide-react";
import MetaTags from "../components/MetaTags";

export default function AboutUs() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      <MetaTags
        title="About Us — Lab Door Customs"
        description="Learn about Lab Door Customs — our story, craftsmanship, and commitment to premium custom footwear."
        path="/about"
      />
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
          Where style meets comfort. We bring you the finest collection of shoes
          from around the world, crafted with passion and delivered with care.
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
            Lab Door Customs was founded and designed by Shivam Negi, a passionate sneaker enthusiast with a sharp eye for detail and originality. Built from a love for beautifully crafted custom footwear, the store celebrates unique design, premium comfort, and bold style. Every pair is curated to help you stand out — whether you're chasing everyday elegance or street-ready edge. At Lab Door Customs, sneakers aren't just shoes; they're a statement of identity
          </p>
          <p
            style={{
              fontSize: isMobile ? 15 : 17,
              color: "#4b5563",
              lineHeight: 1.8,
            }}
          >
            Our carefully curated collection features premium brands and exclusive
            designs that combine contemporary fashion with timeless elegance. Every
            shoe in our store is selected with meticulous attention to quality,
            comfort, and style.
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
              title: "Premium Quality",
              description:
                "Only the finest materials and craftsmanship make it to our collection.",
              delay: 0.4,
            },
            {
              icon: Heart,
              title: "Customer First",
              description:
                "Your satisfaction is our top priority. We're here to help every step of the way.",
              delay: 0.5,
            },
            {
              icon: Truck,
              title: "Fast Delivery",
              description:
                "Free shipping on orders over $1000. Quick and reliable delivery worldwide.",
              delay: 0.6,
            },
            {
              icon: Shield,
              title: "Secure Shopping",
              description:
                "Shop with confidence. Your data is protected with industry-leading security.",
              delay: 0.7,
            },
            {
              icon: Users,
              title: "Expert Team",
              description:
                "Our passionate team of shoe enthusiasts is always ready to assist you.",
              delay: 0.8,
            },
            {
              icon: MapPin,
              title: "Global Reach",
              description:
                "Delivering style to doorsteps across the world with care and precision.",
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
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            Explore our exclusive collection and find your perfect pair today.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: isMobile ? "14px 32px" : "16px 40px",
              background: "white",
              color: "#667eea",
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
            Shop Now
          </a>
        </motion.div>
      </div>
    </div>
  );
}

