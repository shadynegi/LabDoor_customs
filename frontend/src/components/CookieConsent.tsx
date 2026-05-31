// src/components/CookieConsent.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Settings, Check, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = 'lab_door_cookie_consent';
const COOKIE_PREFERENCES_KEY = 'lab_door_cookie_preferences';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    }
  }, []);

  useEffect(() => {
    const openPreferences = () => {
      const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch {
          /* ignore */
        }
      }
      setShowPreferences(true);
      setIsVisible(true);
    };
    window.addEventListener('openCookiePreferences', openPreferences);
    return () => window.removeEventListener('openCookiePreferences', openPreferences);
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    saveConsent(allAccepted);
  };

  const handleAcceptSelected = () => {
    saveConsent(preferences);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    saveConsent(essentialOnly);
  };

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setIsVisible(false);
    
    // Dispatch event for analytics scripts to check consent
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: prefs }));
  };

  const CookieOption = ({ 
    id, 
    title, 
    description, 
    checked, 
    disabled, 
    onChange 
  }: { 
    id: keyof CookiePreferences; 
    title: string; 
    description: string; 
    checked: boolean; 
    disabled?: boolean; 
    onChange: (id: keyof CookiePreferences, value: boolean) => void;
  }) => (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      background: checked ? '#f0fdf4' : '#f9fafb',
      borderRadius: 12,
      border: checked ? '1px solid #10b981' : '1px solid #e5e7eb',
      marginBottom: 12,
      cursor: disabled ? 'default' : 'pointer',
      transition: 'all 0.2s',
    }}
    onClick={() => !disabled && onChange(id, !checked)}
    >
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: checked ? '#10b981' : 'white',
        border: checked ? 'none' : '2px solid #d1d5db',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        {checked && <Check size={16} color="white" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
        }}>
          <span style={{ fontWeight: 600, color: '#1f2937' }}>{title}</span>
          {disabled && (
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              background: '#e5e7eb',
              borderRadius: 4,
              color: '#6b7280',
            }}>
              Required
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'fixed',
            bottom: isMobile ? 0 : 20,
            left: isMobile ? 0 : 20,
            right: isMobile ? 0 : 'auto',
            width: isMobile ? '100%' : showPreferences ? 480 : 420,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'white',
            borderRadius: isMobile ? '20px 20px 0 0' : 20,
            boxShadow: '0 10px 50px rgba(0,0,0,0.2)',
            zIndex: 10000,
          }}
        >
          {/* Header */}
          <div style={{
            padding: isMobile ? '20px 20px 16px' : '24px 24px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Cookie size={24} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>
                  Cookie Settings
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                  Manage your preferences
                </p>
              </div>
            </div>
            <button
              onClick={() => handleRejectNonEssential()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close"
            >
              <X size={20} color="#6b7280" />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: isMobile ? 20 : 24 }}>
            {!showPreferences ? (
              <>
                <p style={{
                  fontSize: 14,
                  color: '#4b5563',
                  lineHeight: 1.7,
                  marginBottom: 20,
                }}>
                  We use cookies to enhance your browsing experience, analyze site traffic, and 
                  personalize content. By clicking "Accept All", you consent to our use of cookies.
                </p>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 12,
                  background: '#f5e0d5',
                  borderRadius: 10,
                  marginBottom: 20,
                }}>
                  <Shield size={18} color="#9c6649" />
                  <span style={{ fontSize: 13, color: '#1e40af' }}>
                    Your privacy is important to us.{' '}
                    <Link to="/privacy-policy" style={{ color: '#9c6649', textDecoration: 'underline' }}>
                      Learn more
                    </Link>
                  </span>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 12,
                }}>
                  <button
                    onClick={handleAcceptAll}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                  >
                    Accept All
                  </button>
                  <button
                    onClick={() => setShowPreferences(true)}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      background: 'white',
                      color: '#374151',
                      border: '2px solid #d1d5db',
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s',
                    }}
                  >
                    <Settings size={18} />
                    Customize
                  </button>
                </div>

                <button
                  onClick={handleRejectNonEssential}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: 12,
                    background: 'transparent',
                    color: '#6b7280',
                    border: 'none',
                    fontSize: 14,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Reject non-essential cookies
                </button>
              </>
            ) : (
              <>
                <CookieOption
                  id="essential"
                  title="Essential Cookies"
                  description="Required for the website to function properly. These cannot be disabled."
                  checked={preferences.essential}
                  disabled={true}
                  onChange={() => {}}
                />
                <CookieOption
                  id="analytics"
                  title="Analytics Cookies"
                  description="Help us understand how visitors interact with our website by collecting anonymous usage data."
                  checked={preferences.analytics}
                  onChange={(id, value) => setPreferences(p => ({ ...p, [id]: value }))}
                />
                <CookieOption
                  id="marketing"
                  title="Marketing Cookies"
                  description="Used to deliver personalized advertisements based on your browsing behavior."
                  checked={preferences.marketing}
                  onChange={(id, value) => setPreferences(p => ({ ...p, [id]: value }))}
                />

                <div style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 20,
                }}>
                  <button
                    onClick={() => setShowPreferences(false)}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      background: 'white',
                      color: '#374151',
                      border: '2px solid #d1d5db',
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAcceptSelected}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Save Preferences
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to check cookie consent
export function useCookieConsent(): CookiePreferences | null {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent) {
      const prefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (prefs) {
        setPreferences(JSON.parse(prefs));
      }
    }

    const handleConsentUpdate = (e: CustomEvent<CookiePreferences>) => {
      setPreferences(e.detail);
    };

    window.addEventListener('cookieConsentUpdated', handleConsentUpdate as EventListener);
    return () => window.removeEventListener('cookieConsentUpdated', handleConsentUpdate as EventListener);
  }, []);

  return preferences;
}

/** Re-open the cookie banner (e.g. footer "Cookie preferences" link). */
export function openCookiePreferences(): void {
  window.dispatchEvent(new Event('openCookiePreferences'));
}
