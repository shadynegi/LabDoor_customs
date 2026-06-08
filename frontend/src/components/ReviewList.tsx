// ReviewList - Display product reviews with filtering and stats
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, CheckCircle, MessageSquare, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../config';
import StarRating from './StarRating';
import { ReviewListSkeleton } from './Skeletons';
import { logError } from '../lib/logger';
import { toast } from 'sonner';
import { useResponsive } from '../hooks/useResponsive';
import { gridCols } from '../lib/responsive';

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  is_verified_purchase: boolean;
  is_recommended: boolean;
  helpful_count: number;
  not_helpful_count: number;
  admin_response?: string;
  created_at: string;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  verified_purchases: number;
  recommended: number;
}

interface ReviewListProps {
  productId: number;
  onWriteReview?: () => void;
}

const ReviewList: React.FC<ReviewListProps> = ({ productId, onWriteReview }) => {
  const { isMobile } = useResponsive();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [votedReviewIds, setVotedReviewIds] = useState<Set<string>>(new Set());

  const fetchReviews = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        sort_by: sortBy,
        page: page.toString(),
        limit: '10',
      });
      if (filterRating) params.append('rating', filterRating.toString());
      if (verifiedOnly) params.append('verified_only', 'true');

      const response = await apiFetch(`/reviews/product/${productId}?${params}`);
      const data = await response.json();

      if (data.success) {
        setReviews(data.data.reviews);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        setFetchError(data.error || 'Could not load reviews');
      }
    } catch (error) {
      logError('Error fetching reviews:', error);
      setFetchError('Could not load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId, sortBy, filterRating, verifiedOnly, page]);

  const handleVote = async (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    try {
      const response = await apiFetch(`/reviews/${reviewId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setVotedReviewIds((prev) => new Set(prev).add(reviewId));
        fetchReviews();
      } else {
        toast.error(data.error || data.message || 'Could not record your vote');
      }
    } catch (error) {
      logError('Error voting:', error);
      toast.error('Could not record your vote. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getRatingPercentage = (count: number) => {
    if (!stats || stats.total_reviews === 0) return 0;
    return Math.round((count / stats.total_reviews) * 100);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Stats Section */}
      {stats && stats.total_reviews > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="review-stats-grid"
          style={{
            background: 'white',
            borderRadius: 16,
            marginBottom: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {/* Average Rating */}
          <div className="review-stats-average">
            <div style={{ fontSize: 48, fontWeight: 800, color: '#1f2937' }}>
              {Number(stats.average_rating).toFixed(1)}
            </div>
            <StarRating rating={Number(stats.average_rating)} showCount={false} size={20} />
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
              {stats.total_reviews} {stats.total_reviews === 1 ? 'review' : 'reviews'}
            </div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
              {stats.recommended > 0 && `${Math.round((stats.recommended / stats.total_reviews) * 100)}% recommend`}
            </div>
          </div>

          {/* Rating Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats[`${['one', 'two', 'three', 'four', 'five'][star - 1]}_star` as keyof ReviewStats] as number;
              const percentage = getRatingPercentage(count);
              return (
                <button
                  key={star}
                  onClick={() => setFilterRating(filterRating === star ? null : star)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: filterRating === star ? '#f3f4f6' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 50, fontSize: 13, color: '#6b7280', textAlign: 'left' }}>
                    {star} star
                  </span>
                  <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: star * 0.1 }}
                      style={{ height: '100%', background: '#fbbf24', borderRadius: 4 }}
                    />
                  </div>
                  <span style={{ width: 40, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Filters & Sort */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: showFilters ? '#9c6649' : 'white',
              color: showFilters ? 'white' : '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Filter size={16} />
            Filters
          </button>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: '#374151',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Verified purchases only
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
            <option value="helpful">Most helpful</option>
          </select>
        </div>
      </div>

      {/* Write Review Button */}
      {onWriteReview && (
        <motion.button
          onClick={onWriteReview}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          <MessageSquare size={18} />
          Write a Review
        </motion.button>
      )}

      {/* Reviews List */}
      {loading ? (
        <ReviewListSkeleton />
      ) : fetchError ? (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            background: 'white',
            borderRadius: 16,
            color: '#6b7280',
          }}
        >
          <AlertCircle size={40} style={{ margin: '0 auto 12px', color: '#dc2626' }} />
          <p style={{ marginBottom: 16 }}>{fetchError}</p>
          <button
            type="button"
            onClick={() => void fetchReviews()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              minHeight: 44,
              border: 'none',
              borderRadius: 8,
              background: '#9c6649',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: 'center',
            padding: 40,
            background: 'white',
            borderRadius: 16,
            color: '#6b7280',
          }}
        >
          <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p style={{ marginBottom: 8 }}>No reviews yet</p>
          <p style={{ fontSize: 14 }}>Be the first to review this product!</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${sortBy}-${filterRating}-${verifiedOnly}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  background: 'white',
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                {/* Review Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <StarRating rating={review.rating} showCount={false} size={16} />
                      {review.is_verified_purchase && (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          color: '#10b981',
                          background: '#d1fae5',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}>
                          <CheckCircle size={12} />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                      {review.customer_name}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {formatDate(review.created_at)}
                  </div>
                </div>

                {/* Review Title */}
                {review.title && (
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
                    {review.title}
                  </h4>
                )}

                {/* Review Content */}
                {review.content && (
                  <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6, marginBottom: 12 }}>
                    {review.content}
                  </p>
                )}

                {/* Pros & Cons */}
                {(review.pros?.length || review.cons?.length) && (
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols(isMobile, '1fr', '1fr 1fr'), gap: 16, marginBottom: 12 }}>
                    {review.pros && review.pros.length > 0 && (
                      <div>
                        {review.pros.map((pro, i) => (
                          <div key={i} style={{ fontSize: 13, color: '#059669', marginBottom: 4 }}>
                            + {pro}
                          </div>
                        ))}
                      </div>
                    )}
                    {review.cons && review.cons.length > 0 && (
                      <div>
                        {review.cons.map((con, i) => (
                          <div key={i} style={{ fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
                            - {con}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendation */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: review.is_recommended ? '#059669' : '#dc2626',
                  marginBottom: 12,
                }}>
                  {review.is_recommended ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                  {review.is_recommended ? 'Recommends this product' : 'Does not recommend'}
                </div>

                {/* Admin Response */}
                {review.admin_response && (
                  <div style={{
                    background: '#f9fafb',
                    borderLeft: '3px solid #9c6649',
                    padding: '12px 16px',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#9c6649', marginBottom: 4 }}>
                      Response from Lab Door Customs
                    </div>
                    <p style={{ fontSize: 13, color: '#4b5563' }}>{review.admin_response}</p>
                  </div>
                )}

                {/* Helpful Votes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Was this review helpful?</span>
                  <button
                    type="button"
                    disabled={votedReviewIds.has(review.id)}
                    onClick={() => handleVote(review.id, 'helpful')}
                    aria-label={`Mark review helpful, ${review.helpful_count} votes`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 12px',
                      minHeight: 44,
                      minWidth: 44,
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#6b7280',
                      cursor: votedReviewIds.has(review.id) ? 'not-allowed' : 'pointer',
                      opacity: votedReviewIds.has(review.id) ? 0.6 : 1,
                    }}
                  >
                    <ThumbsUp size={12} />
                    Yes ({review.helpful_count})
                  </button>
                  <button
                    type="button"
                    disabled={votedReviewIds.has(review.id)}
                    onClick={() => handleVote(review.id, 'not_helpful')}
                    aria-label={`Mark review not helpful, ${review.not_helpful_count} votes`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 12px',
                      minHeight: 44,
                      minWidth: 44,
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    <ThumbsDown size={12} />
                    No ({review.not_helpful_count})
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginTop: 24,
        }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 36,
                height: 36,
                border: 'none',
                borderRadius: 8,
                background: p === page ? '#9c6649' : 'white',
                color: p === page ? 'white' : '#374151',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
