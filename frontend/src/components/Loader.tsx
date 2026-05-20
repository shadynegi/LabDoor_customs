import { motion } from "framer-motion";
import logoAllPages from "../assets/Logo/LogoAllPages.png";

interface LoaderProps {
  isLoading: boolean;
}

export default function Loader({ isLoading }: LoaderProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Spinning ring animation */}
        <div style={{ position: "relative", width: 160, height: 160 }}>
          {/* Outer spinning ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "#667eea",
              borderRightColor: "#764ba2",
            }}
          />

          {/* Inner counter-spinning ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              right: 10,
              bottom: 10,
              borderRadius: "50%",
              border: "2px solid transparent",
              borderBottomColor: "#667eea",
              borderLeftColor: "#764ba2",
            }}
          />

          {/* Logo in center with pulse animation */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.img
              src={logoAllPages}
              alt="Loading..."
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                width: 100,
                height: "auto",
                filter: "drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3))",
                display: "block",
              }}
            />
          </div>
        </div>

        {/* Loading text with dot animation */}
        <motion.div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#667eea",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>Loading</span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2,
            }}
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.4,
            }}
          >
            .
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

