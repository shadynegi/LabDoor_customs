// AdminLogin.tsx - Admin login page
import { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { apiFetch } from '../config';
import { toast } from 'sonner';
import LiquidButton from '../components/LiquidButton';
import { useResponsive } from '../hooks/useResponsive';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export default function AdminLogin() {
  const { isMobile } = useResponsive();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated, setAuthenticated, verify } = useAdminAuth();
  const usernameId = useId();
  const passwordId = useId();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/adminshivamdashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        setAuthenticated(true);
        await verify();
        toast.success('Login successful!');
        navigate('/adminshivamdashboard');
      } else {
        setError(data.error || 'Login failed');
        toast.error(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Unable to connect to server');
      toast.error('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #361906 0%, #9c6649 50%, #361906 100%)',
        padding: isMobile
          ? 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))'
          : 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          padding: isMobile ? 24 : 40,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 10px 40px rgba(156, 102, 73, 0.4)',
            }}
          >
            <Shield size={40} color="white" />
          </motion.div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: 8,
            }}
          >
            Admin Portal
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
            Sign in to access the dashboard
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <AlertCircle size={20} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor={usernameId}
              style={{
                display: 'block',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={20}
                color="rgba(255, 255, 255, 0.4)"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                aria-hidden="true"
              />
              <input
                id={usernameId}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 44px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  color: '#ffffff',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(156, 102, 73, 0.5)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label
              htmlFor={passwordId}
              style={{
                display: 'block',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={20}
                color="rgba(255, 255, 255, 0.4)"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                aria-hidden="true"
              />
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  padding: '14px 44px 14px 44px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  color: '#ffffff',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(156, 102, 73, 0.5)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="rgba(255, 255, 255, 0.4)" />
                ) : (
                  <Eye size={20} color="rgba(255, 255, 255, 0.4)" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <LiquidButton
            onClick={() => {}}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              border: 'none',
              borderRadius: 12,
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            disabled={loading}
          >
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'inherit',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: 20,
                      height: 20,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                    }}
                  />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock size={20} />
                  Sign In
                </>
              )}
            </button>
          </LiquidButton>
        </form>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: 12,
            marginTop: 24,
          }}
        >
          Authorized personnel only
        </p>
      </motion.div>
    </div>
  );
}
