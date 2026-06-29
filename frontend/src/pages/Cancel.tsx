import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";

export default function Cancel() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  useEffect(() => {
    sessionStorage.removeItem("pendingOrder");
    sessionStorage.removeItem("lastPlacedOrder");
    localStorage.removeItem("pendingOrder");
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)",
        padding: isMobile
          ? "max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))"
          : "40px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          maxWidth: 600,
          background: "white",
          borderRadius: 16,
          padding: isMobile ? 24 : 40,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <XCircle size={50} color="white" strokeWidth={2} />
        </motion.div>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#1f2937",
            marginBottom: 12,
          }}
        >
          Payment Cancelled
        </h1>

        <p
          style={{
            fontSize: 16,
            color: "#6b7280",
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          You left checkout before completing your order. Your cart items are still saved.
          You can continue shopping or return to checkout when you are ready.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => navigate("/cart")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-2px)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            <ShoppingCart size={18} />
            View Cart
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              background: "white",
              color: "#374151",
              border: "2px solid #d1d5db",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#9ca3af";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <ArrowLeft size={18} />
            Continue Shopping
          </button>
        </div>
      </motion.div>
    </div>
  );
}
