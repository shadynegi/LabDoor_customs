// ProductReviews - Complete reviews section for product pages
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReviewForm from './ReviewForm';
import ReviewList from './ReviewList';

interface ProductReviewsProps {
  productId: number;
  productName: string;
}

const ProductReviews: React.FC<ProductReviewsProps> = ({ productId, productName }) => {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleReviewSubmitted = () => {
    setShowReviewForm(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh of review list
  };

  return (
    <div style={{ marginTop: 40 }}>
      {/* Section Header */}
      <h2 style={{
        fontSize: 28,
        fontWeight: 800,
        color: '#1f2937',
        marginBottom: 24,
        textAlign: 'center',
      }}>
        Customer Reviews
      </h2>

      {/* Review List */}
      <ReviewList
        key={refreshKey}
        productId={productId}
        onWriteReview={() => setShowReviewForm(true)}
      />

      {/* Review Form Modal */}
      <AnimatePresence>
        {showReviewForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowReviewForm(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                maxHeight: '90vh',
                overflowY: 'auto',
                borderRadius: 16,
              }}
            >
              <ReviewForm
                productId={productId}
                productName={productName}
                onSubmit={handleReviewSubmitted}
                onClose={() => setShowReviewForm(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductReviews;
