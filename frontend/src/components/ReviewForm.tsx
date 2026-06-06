// ReviewForm - Component for submitting product reviews
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Plus, CheckCircle, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { apiFetch } from '../config';
import StarRatingInput from './StarRatingInput';
import { useResponsive } from '../hooks/useResponsive';
import { gridCols } from '../lib/responsive';

interface ReviewFormProps {
  productId: number;
  productName: string;
  onSubmit?: () => void;
  onClose?: () => void;
}

interface FormData {
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  is_recommended: boolean;
  customer_name: string;
  customer_email: string;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  productId,
  productName,
  onSubmit,
  onClose,
}) => {
  const [formData, setFormData] = useState<FormData>({
    rating: 0,
    title: '',
    content: '',
    pros: [],
    cons: [],
    is_recommended: true,
    customer_name: '',
    customer_email: '',
  });
  
  const [newPro, setNewPro] = useState('');
  const [newCon, setNewCon] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { isMobile } = useResponsive();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.rating === 0) {
      setErrorMessage('Please select a rating');
      return;
    }
    
    if (!formData.customer_name.trim() || !formData.customer_email.trim()) {
      setErrorMessage('Please enter your name and email');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await apiFetch('/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitStatus('success');
        setTimeout(() => {
          onSubmit?.();
        }, 2000);
      } else {
        setSubmitStatus('error');
        setErrorMessage(data.error || 'Failed to submit review');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPro = () => {
    if (newPro.trim() && formData.pros.length < 5) {
      setFormData(prev => ({ ...prev, pros: [...prev.pros, newPro.trim()] }));
      setNewPro('');
    }
  };

  const addCon = () => {
    if (newCon.trim() && formData.cons.length < 5) {
      setFormData(prev => ({ ...prev, cons: [...prev.cons, newCon.trim()] }));
      setNewCon('');
    }
  };

  const removePro = (index: number) => {
    setFormData(prev => ({ ...prev, pros: prev.pros.filter((_, i) => i !== index) }));
  };

  const removeCon = (index: number) => {
    setFormData(prev => ({ ...prev, cons: prev.cons.filter((_, i) => i !== index) }));
  };

  if (submitStatus === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          padding: 40,
          textAlign: 'center',
          background: 'white',
          borderRadius: 16,
        }}
      >
        <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Thank You!</h3>
        <p style={{ color: '#6b7280' }}>Your review has been submitted successfully.</p>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        maxWidth: 600,
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 id="review-form-title" style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
          Review {productName}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review form"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              color: '#6b7280',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Rating */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
          Your Rating *
        </label>
        <StarRatingInput
          value={formData.rating}
          onChange={(rating) => setFormData(prev => ({ ...prev, rating }))}
          size={36}
        />
      </div>

      {/* Customer Info */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr', '1fr 1fr'), gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Your Name *
          </label>
          <input
            type="text"
            value={formData.customer_name}
            onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
            placeholder="John Doe"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              fontSize: 15,
              outline: 'none',
            }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
            Your Email *
          </label>
          <input
            type="email"
            value={formData.customer_email}
            onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
            placeholder="john@example.com"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              fontSize: 15,
              outline: 'none',
            }}
            required
          />
        </div>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
          Review Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Sum up your experience in a headline"
          maxLength={100}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            fontSize: 15,
            outline: 'none',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
          Your Review
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Share your experience with this product..."
          rows={4}
          maxLength={2000}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            fontSize: 15,
            outline: 'none',
            resize: 'vertical',
            minHeight: 100,
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          {formData.content.length}/2000
        </div>
      </div>

      {/* Pros & Cons */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr', '1fr 1fr'), gap: 16, marginBottom: 20 }}>
        {/* Pros */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#10b981' }}>
            <ThumbsUp size={16} /> Pros
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={newPro}
              onChange={(e) => setNewPro(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPro())}
              placeholder="Add a pro"
              maxLength={100}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1fae5',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={addPro}
              disabled={formData.pros.length >= 5}
              style={{
                padding: '8px',
                background: '#d1fae5',
                border: 'none',
                borderRadius: 8,
                cursor: formData.pros.length >= 5 ? 'not-allowed' : 'pointer',
                opacity: formData.pros.length >= 5 ? 0.5 : 1,
              }}
            >
              <Plus size={16} color="#10b981" />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {formData.pros.map((pro, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#059669' }}>
                <span style={{ flex: 1 }}>+ {pro}</span>
                <button type="button" onClick={() => removePro(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={14} color="#9ca3af" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cons */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ef4444' }}>
            <ThumbsDown size={16} /> Cons
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={newCon}
              onChange={(e) => setNewCon(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCon())}
              placeholder="Add a con"
              maxLength={100}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #fee2e2',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={addCon}
              disabled={formData.cons.length >= 5}
              style={{
                padding: '8px',
                background: '#fee2e2',
                border: 'none',
                borderRadius: 8,
                cursor: formData.cons.length >= 5 ? 'not-allowed' : 'pointer',
                opacity: formData.cons.length >= 5 ? 0.5 : 1,
              }}
            >
              <Plus size={16} color="#ef4444" />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {formData.cons.map((con, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#dc2626' }}>
                <span style={{ flex: 1 }}>- {con}</span>
                <button type="button" onClick={() => removeCon(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={14} color="#9ca3af" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          Would you recommend this product?
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, is_recommended: true }))}
            style={{
              flex: 1,
              padding: '12px',
              border: formData.is_recommended ? '2px solid #10b981' : '1px solid #e5e7eb',
              borderRadius: 10,
              background: formData.is_recommended ? '#d1fae5' : 'white',
              color: formData.is_recommended ? '#059669' : '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <ThumbsUp size={18} /> Yes
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, is_recommended: false }))}
            style={{
              flex: 1,
              padding: '12px',
              border: !formData.is_recommended ? '2px solid #ef4444' : '1px solid #e5e7eb',
              borderRadius: 10,
              background: !formData.is_recommended ? '#fee2e2' : 'white',
              color: !formData.is_recommended ? '#dc2626' : '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <ThumbsDown size={18} /> No
          </button>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              background: '#fee2e2',
              borderRadius: 10,
              marginBottom: 16,
              color: '#dc2626',
              fontSize: 14,
            }}
          >
            <AlertCircle size={18} />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isSubmitting || formData.rating === 0}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%',
          padding: '14px',
          background: formData.rating === 0 
            ? '#e5e7eb' 
            : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
          color: formData.rating === 0 ? '#9ca3af' : 'white',
          border: 'none',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 700,
          cursor: formData.rating === 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {isSubmitting ? (
          <>Submitting...</>
        ) : (
          <>
            <Send size={18} />
            Submit Review
          </>
        )}
      </motion.button>
    </motion.form>
  );
};

export default ReviewForm;
