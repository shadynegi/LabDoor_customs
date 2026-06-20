// src/pages/Checkout.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCart } from "./CartContext";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiFetch } from "../config";
import { buildResponsiveProductImg, PRODUCT_IMAGE_SIZES } from "../lib/responsiveImage";
import { getNames } from "country-list";
import { resolveDefaultCheckoutCountry } from "../constants/checkoutForm";
import {
  calculateCheckoutPricing,
  FREE_SHIPPING_MESSAGE,
  PROMO_COUPON_MESSAGE,
  VOLUME_DISCOUNT_INFO,
} from "../utils/pricing";
import { toast } from "sonner";
import { getFriendlyError } from "../utils/errorMessages";
import { logError } from "../lib/logger";
import { useResponsive } from "../hooks/useResponsive";
import MobileStickyCta from "../components/MobileStickyCta";
import { setUserEmail, trackCheckoutStart } from "../utils/activityTracker";
import {
  POLICY_CHECKOUT_LABEL,
  REPLACEMENT_POLICY_PATH,
  NO_REFUND_POLICY_SHORT,
} from "../constants/returnPolicy";
import {
  CreditCard,
  User,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  Lock,
  ArrowLeft,
  Loader2,
  Tag,
  X,
  Check,
} from "lucide-react";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

type FormField = keyof FormData;
type FormErrors = Partial<Record<FormField, string>>;

// Move InputField OUTSIDE of Checkout component
const InputField = React.memo(({
  id,
  name,
  label,
  type = "text",
  icon: Icon,
  placeholder,
  required = true,
  autoComplete,
  inputMode,
  value,
  onChange,
  onBlur,
  error,
}: {
  id: string;
  name: FormField;
  label: string;
  type?: string;
  icon: any;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "search" | "url";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
}) => {
  const hasError = !!error;
  const errorId = hasError ? `${id}-error` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 8,
        }}
      >
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#9ca3af",
          }}
        >
          <Icon size={18} />
        </div>
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={hasError}
          aria-describedby={errorId}
          style={{
            width: "100%",
            padding: "12px 12px 12px 44px",
            border: hasError ? "2px solid #ef4444" : "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            transition: "all 0.2s",
            background: "white",
          }}
          onFocus={(e) => {
            if (!hasError) {
              e.target.style.borderColor = "#9c6649";
              e.target.style.boxShadow = "0 0 0 3px rgba(102,126,234,0.1)";
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = hasError ? "#ef4444" : "#d1d5db";
            e.target.style.boxShadow = "none";
            onBlur?.(e);
          }}
        />
      </div>
      {hasError && (
        <motion.div
          id={errorId}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 6,
            fontSize: 13,
            color: "#ef4444",
          }}
        >
          <AlertCircle size={14} />
          {error}
        </motion.div>
      )}
    </div>
  );
});

InputField.displayName = 'InputField';

export default function Checkout() {
  const { state, cartValidationError, isCartValidating, retryCartValidation } = useCart();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [isProcessing, setIsProcessing] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const paymentIdempotencyKey = useRef(crypto.randomUUID());
  const checkoutBlocked = Boolean(cartValidationError) || isCartValidating;
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: resolveDefaultCheckoutCountry(),
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    discount_amount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyError, setPolicyError] = useState("");

  useEffect(() => {
    if (state.items.length > 0) {
      const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
      trackCheckoutStart(state.total, itemCount);
    }
    if (formData.email?.trim()) {
      setUserEmail(formData.email.trim());
    }
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !isMobile) return;

    const updateOffset = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };

    updateOffset();
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    };
  }, [isMobile]);

  // Apply coupon handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const volumeAmount = calculateCheckoutPricing(subtotal, itemCount, 0).volumeDiscount;
    const couponSubtotal = Math.max(0, subtotal - volumeAmount);

    try {
      const response = await apiFetch('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotal: couponSubtotal,
          customer_email: formData.email || undefined,
          items: state.items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      if (!response.ok) {
        setCouponError(
          response.status >= 500
            ? 'Could not validate coupon — server error. Try again.'
            : 'Could not validate coupon — please try again.'
        );
        return;
      }

      const data = await response.json();

      if (data.success && data.valid) {
        setAppliedCoupon({
          id: data.coupon.id,
          code: data.coupon.code,
          discount_type: data.coupon.discount_type,
          discount_value: data.coupon.discount_value,
          discount_amount: data.discount_amount,
        });
        setCouponCode("");
        toast.success(data.message);
      } else {
        setCouponError(data.message || "Invalid coupon code");
      }
    } catch (error) {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove coupon handler
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError("");
  };

  useEffect(() => {
    if (state.items.length === 0) {
      navigate('/cart');
    }
  }, [state.items.length, navigate]);

  const cartSignature = state.items
    .map((item) => `${item.id}:${item.quantity}:${item.price}`)
    .join('|');
  const prevCartSignature = useRef(cartSignature);

  useEffect(() => {
    if (prevCartSignature.current === cartSignature) return;
    prevCartSignature.current = cartSignature;
    setAppliedCoupon(null);
    setCouponError('Cart changed — please re-apply your coupon.');
  }, [cartSignature]);

  const countryNames = useMemo(() => getNames(), []);

  // Calculate totals using shared utility
  const totalItemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.total;
  const pricing = calculateCheckoutPricing(
    subtotal,
    totalItemCount,
    appliedCoupon?.discount_amount || 0
  );
  const { shipping, volumeDiscount, volumeDiscountPercent, couponDiscount, total } = pricing;

  const validateForm = (): { isValid: boolean; errors: FormErrors } => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 3) {
      newErrors.fullName = "Name must be at least 3 characters";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    const digitsOnly = formData.phone.replace(/\D/g, "");
    if (!digitsOnly) {
      newErrors.phone = "Phone number is required";
    } else if (digitsOnly.length < 7) {
      newErrors.phone = "Phone number looks too short";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    } else if (formData.address.trim().length < 10) {
      newErrors.address = "Please enter a complete address";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    if (!formData.zipCode.trim()) {
      newErrors.zipCode = "ZIP / Postal code is required";
    } else if (formData.zipCode.trim().length < 3) {
      newErrors.zipCode = "Invalid ZIP / Postal code";
    }

    if (!formData.country.trim()) {
      newErrors.country = "Country is required";
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const syncActivityEmail = useCallback((email: string) => {
    const trimmed = email.trim();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setUserEmail(trimmed);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as HTMLInputElement & { name: FormField };
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'email') {
      syncActivityEmail(value);
    }
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors, syncActivityEmail]);

  const handleEmailBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    syncActivityEmail(e.target.value);
  }, [syncActivityEmail]);

  const handleCountryChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, country: value }));
    
    if (errors.country) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.country;
        return newErrors;
      });
    }
  }, [errors]);

  const handlePayPalPayment = async () => {
    if (!policyAccepted) {
      setPolicyError("You must accept the No Refund & Replacement Policy to continue.");
      toast.error("Policy acceptance required", {
        description: "Please confirm you understand our no-refund, replacement-only policy.",
        duration: 6000,
      });
      return;
    }
    setPolicyError("");

    const validation = validateForm();
    if (!validation.isValid) {
      const firstErrorField = Object.keys(validation.errors)[0] as FormField;
      const scrollTargetId = firstErrorField === "country" ? "country-input" : firstErrorField;
      const element = document.getElementById(scrollTargetId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsProcessing(true);
    if (formData.email?.trim()) {
      setUserEmail(formData.email.trim());
    }

    try {
      const response = await apiFetch('/paypal/create-payment', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': paymentIdempotencyKey.current },
        body: JSON.stringify({
          amount: total.toFixed(2),
          currency: 'USD',
          description: `Order for ${state.items.length} items`,
          policy_accepted: true,
          coupon_code: appliedCoupon?.code,
          customerInfo: formData,
          items: state.items.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            size_system: item.size?.system,
            size_value: item.size?.value,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const friendlyError = getFriendlyError(data.error || data.message || 'Payment creation failed');
        toast.error(friendlyError.message, {
          description: friendlyError.description,
          duration: 6000,
        });
        throw new Error('Payment creation failed');
      }

      const serverTotal =
        data.total != null ? parseFloat(String(data.total)) : null;
      if (serverTotal != null && Math.abs(serverTotal - total) > 0.01) {
        toast.error('Pricing was updated', {
          description: `Your total is now $${serverTotal.toFixed(2)}. Please review and try again.`,
          duration: 8000,
        });
        setIsProcessing(false);
        return;
      }
      
      const approvalUrl = data.links?.find((link: any) => 
        link.rel === 'approval_url' || link.rel === 'approve'
      )?.href;

      if (approvalUrl) {
        sessionStorage.setItem('pendingOrder', JSON.stringify({
          total: serverTotal ?? total,
          serverOrderId: data.serverOrderId,
          orderNumber: data.orderNumber,
          paypalOrderId: data.orderId,
          idempotencyKey: paymentIdempotencyKey.current,
          coupon: appliedCoupon ? {
            id: data.couponId || appliedCoupon.id,
            code: appliedCoupon.code,
            discount_amount: data.discount ?? appliedCoupon.discount_amount,
          } : null,
          timestamp: new Date().toISOString(),
        }));
        sessionStorage.setItem('checkoutRecovery', JSON.stringify({
          formData,
          items: state.items,
        }));
        localStorage.removeItem('pendingOrder');

        window.location.href = approvalUrl;
      } else {
        throw new Error('No approval URL received from PayPal');
      }
    } catch (error) {
      logError('Payment error:', error);
      paymentIdempotencyKey.current = crypto.randomUUID();
      if (error instanceof Error && error.message !== 'Payment creation failed') {
        const friendlyError = getFriendlyError(error);
        toast.error(friendlyError.message, {
          description: friendlyError.description,
          duration: 6000,
        });
      }
      setIsProcessing(false);
    }
  };

  const countryHasError = !!errors.country;
  const countryErrorId = countryHasError ? "country-error" : undefined;

  return (
    <div
      className={
        isMobile
          ? `has-mobile-sticky-cta${
              cartValidationError || !policyAccepted ? ' has-sticky-hint' : ''
            }`
          : undefined
      }
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)",
        padding: isMobile ? "20px" : "40px 20px",
        paddingBottom: isMobile
          ? `calc(var(--sticky-footer-height) + var(--safe-bottom) + 16px + ${keyboardOffset}px)`
          : "20px",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 32 }}
        >
          <button
            onClick={() => navigate("/cart")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              color: "#374151",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 20,
              padding: "8px 0",
            }}
          >
            <ArrowLeft size={16} />
            Back to Cart
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={24} color="white" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: isMobile ? 28 : 36,
                  fontWeight: 800,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                Secure Checkout
              </h1>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                Complete your purchase
              </p>
            </div>
          </div>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr minmax(320px, 380px)",
            gap: isMobile ? 20 : 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: isMobile ? 20 : 32,
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1f2937",
                  marginBottom: 24,
                }}
              >
                Shipping Information
              </h2>

              <div style={{ display: "grid", gap: 20 }}>
                <InputField
                  id="fullName"
                  name="fullName"
                  label="Full Name"
                  icon={User}
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  error={errors.fullName}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <InputField
                    id="email"
                    name="email"
                    label="Email"
                    type="email"
                    icon={Mail}
                    placeholder="john@example.com"
                    autoComplete="email"
                    inputMode="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleEmailBlur}
                    error={errors.email}
                  />
                  <InputField
                    id="phone"
                    name="phone"
                    label="Phone"
                    type="tel"
                    icon={Phone}
                    placeholder="+1 (555) 000-0000"
                    autoComplete="tel"
                    inputMode="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    error={errors.phone}
                  />
                </div>

                <InputField
                  id="address"
                  name="address"
                  label="Street Address"
                  icon={MapPin}
                  placeholder="123 Main Street, Apt 4B"
                  autoComplete="street-address"
                  value={formData.address}
                  onChange={handleChange}
                  error={errors.address}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <InputField
                    id="city"
                    name="city"
                    label="City"
                    icon={MapPin}
                    placeholder="New York"
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={handleChange}
                    error={errors.city}
                  />
                  <InputField
                    id="state"
                    name="state"
                    label="State / Province"
                    icon={MapPin}
                    placeholder="NY"
                    autoComplete="address-level1"
                    value={formData.state}
                    onChange={handleChange}
                    error={errors.state}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <InputField
                    id="zipCode"
                    name="zipCode"
                    label="ZIP / Postal Code"
                    icon={MapPin}
                    placeholder="10001"
                    autoComplete="postal-code"
                    inputMode="text"
                    value={formData.zipCode}
                    onChange={handleChange}
                    error={errors.zipCode}
                  />
                  <div>
                    <label
                      htmlFor="country-input"
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 8,
                      }}
                    >
                      Country <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      id="country-input"
                      name="country"
                      value={formData.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      aria-invalid={countryHasError}
                      aria-describedby={countryErrorId}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        fontSize: 15,
                        borderRadius: 8,
                        border: countryHasError ? "2px solid #ef4444" : "1px solid #d1d5db",
                        background: "white",
                        color: "#1f2937",
                      }}
                    >
                      <option value="">Select a country...</option>
                      {countryNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {countryHasError && (
                      <motion.div
                        id={countryErrorId}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 6,
                          fontSize: 13,
                          color: "#ef4444",
                        }}
                      >
                        <AlertCircle size={14} />
                        {errors.country}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              position: isMobile ? "relative" : "sticky",
              top: isMobile ? "auto" : 24,
              height: "fit-content",
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1f2937",
                  marginBottom: 20,
                }}
              >
                Order Summary
              </h2>

              <div style={{ marginBottom: 20 }}>
                {state.items.map((item, index) => (
                  <div
                    key={`${item.id}-${item.size?.system}-${item.size?.value}-${index}`}
                    style={{
                      display: "flex",
                      gap: 12,
                      marginBottom: 16,
                      paddingBottom: 16,
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        background: "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        {...buildResponsiveProductImg(item.image, {
                          alt: item.name,
                          sizes: PRODUCT_IMAGE_SIZES.checkout,
                          width: 80,
                          height: 80,
                        })}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#1f2937",
                          marginBottom: 4,
                        }}
                      >
                        {item.name}
                      </div>
                      {item.size && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
                          Size: {item.size.system} {item.size.value}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        Qty: {item.quantity}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Input */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  <Tag size={16} />
                  Coupon Code
                </label>
                
                {appliedCoupon ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      padding: "12px 16px",
                      background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                      borderRadius: 8,
                      border: "1px solid #10b981",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
                      <Check size={18} color="#059669" />
                      <span style={{ fontWeight: 600, color: "#047857" }}>
                        {appliedCoupon.code}
                      </span>
                      <span style={{ color: "#059669", fontSize: 14 }}>
                        ({appliedCoupon.discount_type === 'percentage' 
                          ? `${appliedCoupon.discount_value}% off` 
                          : `$${appliedCoupon.discount_value} off`})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      aria-label="Remove coupon"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        minWidth: 44,
                        minHeight: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X size={18} color="#059669" />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      placeholder="Enter code"
                      style={{
                        flex: 1,
                        padding: "12px 14px",
                        border: couponError ? "2px solid #ef4444" : "2px solid #e5e7eb",
                        borderRadius: 8,
                        fontSize: 14,
                        textTransform: "uppercase",
                        outline: "none",
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      style={{
                        padding: "12px 20px",
                        background: couponLoading || !couponCode.trim()
                          ? "#d1d5db"
                          : "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: couponLoading || !couponCode.trim() ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                
                {couponError && (
                  <p style={{ color: "#ef4444", fontSize: 13, marginTop: 6, margin: 0 }}>
                    {couponError}
                  </p>
                )}

                {!appliedCoupon && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      marginTop: 10,
                      marginBottom: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {PROMO_COUPON_MESSAGE}
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 12,
                    lineHeight: 1.5,
                    padding: "10px 12px",
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div>{VOLUME_DISCOUNT_INFO.twoPlus}</div>
                  <div style={{ marginTop: 4 }}>{VOLUME_DISCOUNT_INFO.fivePlus}</div>
                  {volumeDiscount > 0 && (
                    <div style={{ marginTop: 8, color: "#059669", fontWeight: 600 }}>
                      {volumeDiscountPercent}% multi-item discount applied (
                      {totalItemCount} items) — saves ${volumeDiscount.toFixed(2)}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    fontSize: 14,
                    color: "#6b7280",
                  }}
                >
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {volumeDiscount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                      fontSize: 14,
                      color: "#10b981",
                      fontWeight: 600,
                    }}
                  >
                    <span>Multi-item discount ({volumeDiscountPercent}%)</span>
                    <span>-${volumeDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    fontSize: 14,
                    color: "#6b7280",
                  }}
                >
                  <span>Shipping</span>
                  <span>{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span>
                </div>
                {shipping === 0 && (
  <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
    {FREE_SHIPPING_MESSAGE}
  </div>
)}

                {appliedCoupon && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                      fontSize: 14,
                      color: "#10b981",
                      fontWeight: 600,
                    }}
                  >
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-${couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                
                <div
                  style={{
                    borderTop: "2px solid #e5e7eb",
                    paddingTop: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#1f2937",
                  }}
                >
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {cartValidationError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 12,
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

              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: 12,
                  fontSize: 13,
                  color: '#7c2d12',
                  lineHeight: 1.6,
                }}
              >
                <strong>All sales are final.</strong> {NO_REFUND_POLICY_SHORT}{' '}
                <Link to={REPLACEMENT_POLICY_PATH} style={{ color: '#9c6649', fontWeight: 600 }}>
                  Replacement Policy
                </Link>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 16,
                  fontSize: 13,
                  color: '#374151',
                  lineHeight: 1.5,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => {
                    setPolicyAccepted(e.target.checked);
                    if (e.target.checked) setPolicyError('');
                  }}
                  style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                />
                <span>
                  {POLICY_CHECKOUT_LABEL}{' '}
                  <Link to="/terms-of-service" style={{ color: '#9c6649' }}>
                    Terms of Service
                  </Link>
                  .
                </span>
              </label>
              {policyError && (
                <p role="alert" style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>
                  {policyError}
                </p>
              )}

              <button
                onClick={handlePayPalPayment}
                disabled={isProcessing || checkoutBlocked || !policyAccepted}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: isProcessing || checkoutBlocked
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #0070ba 0%, #1546a0 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: isProcessing || checkoutBlocked ? "not-allowed" : "pointer",
                  display: isMobile ? "none" : "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  marginBottom: 12,
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,112,186,0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    Pay with PayPal
                  </>
                )}
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                <Lock size={14} />
                Secure 256-bit SSL encryption
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      {isMobile && (
        <MobileStickyCta
          amount={`$${total.toFixed(2)}`}
          label={isProcessing ? "Processing…" : "Pay with PayPal"}
          onClick={handlePayPalPayment}
          disabled={isProcessing || checkoutBlocked || !policyAccepted}
          keyboardOffset={keyboardOffset}
          ariaLabel="Complete payment"
          hint={
            cartValidationError ? (
              <div role="alert">
                <p style={{ margin: '0 0 8px', color: '#991b1b' }}>{cartValidationError}</p>
                <button
                  type="button"
                  onClick={retryCartValidation}
                  disabled={isCartValidating}
                  style={{
                    padding: '6px 12px',
                    background: '#9c6649',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isCartValidating ? 'not-allowed' : 'pointer',
                    opacity: isCartValidating ? 0.7 : 1,
                  }}
                >
                  {isCartValidating ? 'Validating…' : 'Retry validation'}
                </button>
              </div>
            ) : !policyAccepted ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  cursor: 'pointer',
                  color: '#7c2d12',
                }}
              >
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => {
                    setPolicyAccepted(e.target.checked);
                    if (e.target.checked) setPolicyError('');
                  }}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
                />
                <span>
                  Accept no-refund / replacement-only policy to pay.{' '}
                  <Link to={REPLACEMENT_POLICY_PATH} style={{ color: '#9c6649', fontWeight: 600 }}>
                    Policy
                  </Link>
                </span>
              </label>
            ) : undefined
          }
        />
      )}
    </div>
  );
}