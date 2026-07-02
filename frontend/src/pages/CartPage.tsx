// src/pages/CartPage.tsx - Mobile Responsive Version
import { useResponsive } from "../hooks/useResponsive";
import MobileStickyCta from "../components/MobileStickyCta";
import { useCart } from "./CartContext";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { calculateCheckoutPricing, FREE_SHIPPING_MESSAGE, VOLUME_DISCOUNT_INFO } from "../utils/pricing";
import { buildResponsiveProductImg, PRODUCT_IMAGE_SIZES } from "../lib/responsiveImage";
import { NO_REFUND_POLICY_SHORT, REPLACEMENT_POLICY_PATH } from "../constants/returnPolicy";

export default function CartPage() {
  const {
    state,
    incrementQuantity,
    decrementQuantity,
    removeFromCart,
    cartValidationError,
    isCartValidating,
    retryCartValidation,
  } = useCart();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  
  // Calculate totals using shared utility
  const totalItemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const pricing = calculateCheckoutPricing(state.total, totalItemCount, 0);
  const { subtotal, shipping, total, volumeDiscount, volumeDiscountPercent } = pricing;

  const hasItems = state.items.length > 0;
  const checkoutBlocked = Boolean(cartValidationError) || isCartValidating;

  return (
    <div
      className={
        isMobile && hasItems ? "has-mobile-sticky-cta has-mobile-sticky-cta--stacked" : undefined
      }
      style={{
      paddingTop: isMobile ? "16px" : "24px",
      paddingLeft: isMobile ? "16px" : "24px",
      paddingRight: isMobile ? "16px" : "24px",
      paddingBottom:
        isMobile && hasItems
          ? undefined
          : isMobile
            ? "max(16px, env(safe-area-inset-bottom))"
            : "24px",
      maxWidth: 1000,
      margin: "0 auto",
      minHeight: "calc(100vh - 200px)"
    }}>
      <h2 style={{ 
        fontSize: isMobile ? 24 : 32, 
        fontWeight: 800,
        marginBottom: isMobile ? 16 : 24,
        color: "#1f2937"
      }}>Your Cart</h2>
      {state.items.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: isMobile ? "40px 20px" : "60px 40px",
          background: "#f9fafb",
          borderRadius: 16,
        }}>
          <ShoppingBag size={isMobile ? 48 : 64} color="#9ca3af" style={{ marginBottom: 16 }} />
          <p style={{ fontSize: isMobile ? 16 : 18, color: "#6b7280", marginBottom: 20 }}>
            Your cart is empty
          </p>
          <Link 
            to="/" 
            style={{
              display: "inline-block",
              padding: isMobile ? "12px 24px" : "14px 32px",
              background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
              color: "white",
              textDecoration: "none",
              borderRadius: 12,
              fontSize: isMobile ? 14 : 16,
              fontWeight: 600,
            }}
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {state.items.map((item, index) => (
              <li key={`${item.id}-${item.size?.system}-${item.size?.value}-${index}`} style={{ 
                marginBottom: isMobile ? 12 : 16, 
                padding: isMobile ? 12 : 16, 
                border: "1px solid #e5e7eb", 
                borderRadius: 12,
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
              }}>
                <div style={{ 
                  display: "flex", 
                  gap: isMobile ? 12 : 16, 
                  alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row"
                }}>
                  {/* Product Image and Info */}
                  <div style={{ 
                    display: "flex", 
                    gap: 12, 
                    alignItems: "center",
                    flex: 1,
                    width: isMobile ? "100%" : "auto"
                  }}>
                    <img 
                      {...buildResponsiveProductImg(item.image, {
                        alt: item.name,
                        sizes: PRODUCT_IMAGE_SIZES.cart,
                        width: isMobile ? 70 : 90,
                        height: isMobile ? 70 : 90,
                      })}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      style={{ 
                        width: isMobile ? 70 : 90, 
                        height: isMobile ? 70 : 90, 
                        objectFit: "contain", 
                        borderRadius: 8,
                        background: "#f9fafb",
                        padding: 8
                      }}
                    />
                    
                    <div style={{ flex: 1 }}>
                      <strong style={{ 
                        fontSize: isMobile ? 14 : 16, 
                        display: "block",
                        marginBottom: 4,
                        color: "#1f2937"
                      }}>
                        {item.name}
                      </strong>
                      {item.size && (
                        <div style={{ 
                          color: "#6b7280", 
                          fontSize: isMobile ? 12 : 13,
                          marginTop: 4,
                          fontWeight: 500,
                        }}>
                          Size: {item.size.system} {item.size.value}
                        </div>
                      )}
                      <div style={{ 
                        color: "#6b7280", 
                        fontSize: isMobile ? 13 : 14,
                        marginTop: 4
                      }}>
                        ${item.price.toFixed(2)} each
                      </div>
                      <div style={{
                        color: "#374151",
                        fontSize: isMobile ? 14 : 15,
                        fontWeight: 600,
                        marginTop: 6
                      }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div style={{ 
                    display: "flex", 
                    gap: isMobile ? 8 : 12, 
                    alignItems: "center",
                    justifyContent: isMobile ? "space-between" : "flex-end",
                    width: isMobile ? "100%" : "auto"
                  }}>
                    <div style={{ 
                      display: "flex", 
                      gap: 4, 
                      alignItems: "center",
                      background: "#f9fafb",
                      padding: isMobile ? "4px" : "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb"
                    }}>
                      <button 
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => decrementQuantity(item.id, item.size)}
                        style={{ 
                          width: isMobile ? 44 : 36,
                          height: isMobile ? 44 : 36,
                          padding: 0,
                          cursor: "pointer",
                          background: "white",
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#374151",
                          fontSize: 16,
                          fontWeight: 600,
                          transition: "all 0.2s"
                        }}
                      >
                        <Minus size={isMobile ? 18 : 16} />
                      </button>
                      <span style={{ 
                        minWidth: isMobile ? 40 : 32, 
                        textAlign: "center",
                        fontSize: isMobile ? 16 : 15,
                        fontWeight: 600,
                        color: "#1f2937"
                      }}>
                        {item.quantity}
                      </span>
                      <button 
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => incrementQuantity(item.id, item.size)}
                        style={{ 
                          width: isMobile ? 44 : 36,
                          height: isMobile ? 44 : 36,
                          padding: 0,
                          cursor: "pointer",
                          background: "white",
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#374151",
                          fontSize: 16,
                          fontWeight: 600,
                          transition: "all 0.2s"
                        }}
                      >
                        <Plus size={isMobile ? 18 : 16} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id, item.size)}
                      style={{ 
                        padding: isMobile ? "12px 16px" : "10px 18px",
                        minHeight: isMobile ? 44 : 36,
                        background: "#fee2e2",
                        color: "#dc2626",
                        border: "1px solid #fecaca",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: isMobile ? 15 : 14,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fecaca";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fee2e2";
                      }}
                    >
                      <Trash2 size={isMobile ? 18 : 16} />
                      {!isMobile && "Remove"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Order Summary */}
          <div style={{ 
            marginTop: isMobile ? 24 : 30, 
            padding: isMobile ? 16 : 24, 
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: 16,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
          }}>
            <h3 style={{ 
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              marginBottom: isMobile ? 16 : 20,
              color: "#1f2937"
            }}>
              Order Summary
            </h3>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              marginBottom: 12,
              fontSize: isMobile ? 14 : 15,
              color: "#6b7280"
            }}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: 600, color: "#374151" }}>${subtotal.toFixed(2)}</span>
            </div>
            {volumeDiscount > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                fontSize: isMobile ? 14 : 15,
                color: "#10b981",
                fontWeight: 600,
              }}>
                <span>Multi-item discount ({volumeDiscountPercent}%)</span>
                <span>-${volumeDiscount.toFixed(2)}</span>
              </div>
            )}
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>
              {VOLUME_DISCOUNT_INFO.twoPlus}. {VOLUME_DISCOUNT_INFO.fivePlus}.
            </p>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              marginBottom: 12,
              fontSize: isMobile ? 14 : 15,
              color: "#6b7280"
            }}>
              <span>Shipping:</span>
              <span style={{ 
                fontWeight: 600, 
                color: shipping === 0 ? "#10b981" : "#374151"
              }}>
                {shipping === 0 ? FREE_SHIPPING_MESSAGE : `$${shipping.toFixed(2)}`}
              </span>
            </div>           
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              fontSize: isMobile ? 18 : 22, 
              fontWeight: 800, 
              borderTop: "2px solid #e5e7eb", 
              paddingTop: 16,
              color: "#1f2937"
            }}>
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <p
            data-testid="cart-policy-notice"
            style={{
              marginTop: 16,
              padding: 14,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 12,
              fontSize: 13,
              color: '#7c2d12',
              lineHeight: 1.55,
            }}
          >
            <strong>All sales final.</strong> {NO_REFUND_POLICY_SHORT}{' '}
            <Link to={REPLACEMENT_POLICY_PATH} style={{ color: '#9c6649', fontWeight: 600 }}>
              Replacement Policy
            </Link>
          </p>

          {cartValidationError && (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: 14,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 12,
                color: '#991b1b',
                fontSize: 14,
              }}
            >
              <p style={{ margin: '0 0 12px' }}>{cartValidationError}</p>
              <button
                type="button"
                onClick={retryCartValidation}
                disabled={isCartValidating}
                style={{
                  padding: '8px 14px',
                  background: '#9c6649',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: isCartValidating ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: isCartValidating ? 0.7 : 1,
                }}
              >
                {isCartValidating ? 'Validating…' : 'Retry validation'}
              </button>
            </div>
          )}

          {/* Action Buttons — hide primary CTA on mobile when sticky bar is shown */}
          <div style={{ 
            marginTop: isMobile ? 20 : 24, 
            display: isMobile && hasItems ? "none" : "flex", 
            flexDirection: isMobile ? "column" : "row",
            gap: 12 
          }}>
            <button 
              onClick={() => navigate("/checkout")}
              disabled={checkoutBlocked}
              style={{ 
                flex: 1, 
                padding: isMobile ? "14px 24px" : "16px 32px",
                background: checkoutBlocked
                  ? "#9ca3af"
                  : "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                color: "white", 
                border: "none", 
                borderRadius: 12, 
                fontSize: isMobile ? 15 : 16, 
                fontWeight: 700, 
                cursor: checkoutBlocked ? "not-allowed" : "pointer",
                opacity: checkoutBlocked ? 0.85 : 1,
                boxShadow: "0 4px 6px -1px rgba(102,126,234,0.3)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (checkoutBlocked) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 12px -2px rgba(102,126,234,0.4)";
              }}
              onMouseLeave={(e) => {
                if (checkoutBlocked) return;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(102,126,234,0.3)";
              }}
            >
              {isCartValidating ? 'Validating cart…' : 'Proceed to Checkout'}
            </button>
            <button 
              onClick={() => navigate("/products")}
              style={{ 
                padding: isMobile ? "14px 24px" : "16px 32px",
                background: "white", 
                color: "#374151", 
                border: "2px solid #d1d5db", 
                borderRadius: 12, 
                fontSize: isMobile ? 15 : 16, 
                fontWeight: 700, 
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#9ca3af";
                e.currentTarget.style.background = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.background = "white";
              }}
            >
              Continue Shopping
            </button>
          </div>
          {isMobile && hasItems && <div className="cart-mobile-sticky-spacer" aria-hidden="true" />}
        </>
      )}
      {isMobile && hasItems && (
        <MobileStickyCta
          amount={`$${total.toFixed(2)}`}
          label="Checkout"
          onClick={() => !checkoutBlocked && navigate("/checkout")}
          disabled={checkoutBlocked}
          secondaryLabel="Continue Shopping"
          onSecondaryClick={() => navigate("/products")}
          stacked
          ariaLabel="Cart checkout actions"
        />
      )}
    </div>
  );
}