// components/EmptyStates.tsx
// Reusable empty state components with CTAs

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Package,
  Heart,
  Search,
  AlertCircle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionPath?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryPath?: string;
  onSecondary?: () => void;
}

// Base empty state component
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  actionPath,
  onAction,
  secondaryLabel,
  secondaryPath,
  onSecondary,
}: EmptyStateProps) {
  const navigate = useNavigate();

  const handlePrimaryAction = () => {
    if (onAction) {
      onAction();
    } else if (actionPath) {
      navigate(actionPath);
    }
  };

  const handleSecondaryAction = () => {
    if (onSecondary) {
      onSecondary();
    } else if (secondaryPath) {
      navigate(secondaryPath);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        maxWidth: 400,
        margin: '0 auto',
      }}
    >
      {icon && (
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#1f2937',
          marginBottom: 12,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 16,
          color: '#6b7280',
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        {description}
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {actionLabel && (
          <button
            onClick={handlePrimaryAction}
            style={{
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(156, 102, 73, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {actionLabel}
          </button>
        )}

        {secondaryLabel && (
          <button
            onClick={handleSecondaryAction}
            style={{
              padding: '14px 28px',
              background: 'white',
              color: '#374151',
              border: '2px solid #d1d5db',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Empty cart state
export function EmptyCartState() {
  return (
    <EmptyState
      icon={<ShoppingCart size={40} color="#9ca3af" />}
      title="Your cart is empty"
      description="Looks like you haven't added any items yet. Start shopping to find your perfect pair!"
      actionLabel="Browse Products"
      actionPath="/products"
      secondaryLabel="View Deals"
      secondaryPath="/"
    />
  );
}

// No orders found state
export function NoOrdersState({ email }: { email?: string }) {
  return (
    <EmptyState
      icon={<Package size={40} color="#9ca3af" />}
      title="No orders found"
      description={
        email
          ? `We couldn't find any orders for ${email}. Make sure you're using the correct email address.`
          : "You haven't placed any orders yet. Start shopping to see your orders here!"
      }
      actionLabel="Start Shopping"
      actionPath="/products"
      secondaryLabel="Try Another Email"
      secondaryPath="/orders"
    />
  );
}

// Empty wishlist state
export function EmptyWishlistState() {
  return (
    <EmptyState
      icon={<Heart size={40} color="#9ca3af" />}
      title="Your wishlist is empty"
      description="Save items you love by tapping the heart icon. They'll appear here for easy access!"
      actionLabel="Explore Products"
      actionPath="/products"
    />
  );
}

// No search results state
export function NoSearchResultsState({
  query,
  onClearFilters,
}: {
  query?: string;
  onClearFilters?: () => void;
}) {
  return (
    <EmptyState
      icon={<Search size={40} color="#9ca3af" />}
      title="No results found"
      description={
        query
          ? `We couldn't find anything matching "${query}". Try different keywords or browse our categories.`
          : "No products match your filters. Try adjusting your search criteria."
      }
      actionLabel="View All Products"
      actionPath="/products"
      secondaryLabel={onClearFilters ? "Clear Filters" : undefined}
      onSecondary={onClearFilters}
    />
  );
}

// Error state
export function ErrorState({
  title = "Something went wrong",
  description = "We encountered an unexpected error. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle size={40} color="#ef4444" />}
      title={title}
      description={description}
      actionLabel={onRetry ? "Try Again" : "Go Home"}
      onAction={onRetry}
      actionPath={onRetry ? undefined : "/"}
    />
  );
}

// Offline state
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<WifiOff size={40} color="#f59e0b" />}
      title="You're offline"
      description="Please check your internet connection and try again."
      actionLabel="Retry"
      onAction={onRetry || (() => window.location.reload())}
    />
  );
}

// Loading failed state
export function LoadingFailedState({ onRetry }: { onRetry?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        textAlign: 'center',
        padding: '40px 24px',
      }}
    >
      <RefreshCw size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Failed to load content
      </p>
      <button
        onClick={onRetry || (() => window.location.reload())}
        style={{
          padding: '12px 24px',
          background: '#f3f4f6',
          color: '#374151',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <RefreshCw size={16} />
        Try Again
      </button>
    </motion.div>
  );
}
