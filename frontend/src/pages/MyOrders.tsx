// MyOrders.tsx - Enhanced Order tracking page with visual timeline
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock,
  ExternalLink,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  PackageCheck,
  Home,
  XCircle,
  Filter,
  Hash,
  X,
  KeyRound
} from 'lucide-react';
import { apiFetch } from '../config';
import { toast } from 'sonner';
import { OrdersListSkeleton } from '../components/Skeletons';
import { logError } from '../lib/logger';

interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  shipping_address: any;
  items: any[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  payment_status: string;
  status: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  estimated_delivery?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

// Order status timeline steps
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered'] as const;
type OrderStatus = typeof ORDER_STATUSES[number] | 'cancelled';

interface TimelineStep {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { 
    status: 'pending', 
    label: 'Order Placed', 
    description: 'Your order has been received',
    icon: <ShoppingBag size={20} />
  },
  { 
    status: 'processing', 
    label: 'Processing', 
    description: 'We\'re preparing your order',
    icon: <Package size={20} />
  },
  { 
    status: 'shipped', 
    label: 'Shipped', 
    description: 'On the way to you',
    icon: <Truck size={20} />
  },
  { 
    status: 'delivered', 
    label: 'Delivered', 
    description: 'Package has arrived',
    icon: <Home size={20} />
  },
];

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000;

const TRACKED_ORDERS_KEY = 'labdoor_tracked_orders';

interface TrackedOrderRef {
  orderNumber: string;
  token: string;
}

function getTrackedOrders(): TrackedOrderRef[] {
  try {
    const raw = sessionStorage.getItem(TRACKED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTrackedOrder(ref: TrackedOrderRef) {
  const existing = getTrackedOrders().filter((o) => o.orderNumber !== ref.orderNumber);
  sessionStorage.setItem(TRACKED_ORDERS_KEY, JSON.stringify([ref, ...existing]));
}

async function lookupOrderByToken(orderNumber: string, token: string) {
  const response = await apiFetch('/orders/lookup', {
    method: 'POST',
    body: JSON.stringify({
      orderNumber: orderNumber.trim(),
      accessToken: token.trim(),
    }),
  });
  const data = await response.json();
  return { response, data };
}

function normalizeOrder(order: any): Order {
  return {
    ...order,
    subtotal: parseFloat(order.subtotal?.toString() || '0'),
    shipping_cost: parseFloat(order.shipping_cost?.toString() || '0'),
    tax: parseFloat(order.tax?.toString() || '0'),
    total: parseFloat(order.total?.toString() || '0'),
    items: (order.items || []).map((item: any) => ({
      ...item,
      price: parseFloat(item.price?.toString() || '0'),
    })),
  };
}

// Timeline Component
function OrderTimeline({ order, isMobile }: { order: Order; isMobile: boolean }) {
  const currentStatusIndex = ORDER_STATUSES.indexOf(order.status as typeof ORDER_STATUSES[number]);
  const isCancelled = order.status === 'cancelled';

  if (isCancelled) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        borderRadius: 12,
        padding: isMobile ? 16 : 20,
        marginBottom: 16,
        border: '1px solid #fecaca',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#dc2626',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}>
            <XCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Order Cancelled</div>
            <div style={{ fontSize: 14, color: '#991b1b' }}>
              This order has been cancelled
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 100%)',
      borderRadius: 12,
      padding: isMobile ? 16 : 24,
      marginBottom: 16,
      border: '1px solid #e8c9b8',
    }}>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#0369a1',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <PackageCheck size={18} />
        Order Progress
      </div>
      
      {/* Timeline */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        position: 'relative',
        gap: isMobile ? 0 : 0,
      }}>
        {/* Progress Line (Desktop) */}
        {!isMobile && (
          <div style={{
            position: 'absolute',
            top: 20,
            left: 40,
            right: 40,
            height: 4,
            background: '#e2e8f0',
            borderRadius: 2,
            zIndex: 0,
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ 
                width: `${Math.min(100, (currentStatusIndex / (TIMELINE_STEPS.length - 1)) * 100)}%` 
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                borderRadius: 2,
              }}
            />
          </div>
        )}
        
        {TIMELINE_STEPS.map((step, index) => {
          const isCompleted = currentStatusIndex >= index;
          const isCurrent = currentStatusIndex === index;
          
          return (
            <motion.div
              key={step.status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'row' : 'column',
                alignItems: 'center',
                gap: isMobile ? 12 : 8,
                flex: 1,
                position: 'relative',
                zIndex: 1,
                paddingBottom: isMobile && index < TIMELINE_STEPS.length - 1 ? 20 : 0,
              }}
            >
              {/* Mobile Progress Line */}
              {isMobile && index < TIMELINE_STEPS.length - 1 && (
                <div style={{
                  position: 'absolute',
                  left: 19,
                  top: 40,
                  width: 3,
                  height: 'calc(100% - 20px)',
                  background: isCompleted ? '#10b981' : '#e2e8f0',
                  borderRadius: 2,
                }} />
              )}
              
              {/* Icon Circle */}
              <motion.div
                animate={{
                  scale: isCurrent ? [1, 1.1, 1] : 1,
                  boxShadow: isCurrent 
                    ? '0 0 0 4px rgba(16, 185, 129, 0.2)' 
                    : 'none',
                }}
                transition={{
                  scale: { repeat: isCurrent ? Infinity : 0, duration: 2 },
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: isCompleted 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isCompleted ? 'white' : '#94a3b8',
                  flexShrink: 0,
                  transition: 'all 0.3s ease',
                }}
              >
                {isCompleted ? <CheckCircle size={20} /> : step.icon}
              </motion.div>
              
              {/* Text */}
              <div style={{
                textAlign: isMobile ? 'left' : 'center',
                flex: isMobile ? 1 : 'none',
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: isCompleted ? '#059669' : '#64748b',
                  marginBottom: 2,
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#94a3b8',
                }}>
                  {step.description}
                </div>
                {isCurrent && order.estimated_delivery && step.status === 'shipped' && (
                  <div style={{
                    fontSize: 11,
                    color: '#0369a1',
                    marginTop: 4,
                    fontWeight: 500,
                  }}>
                    Est. {new Date(order.estimated_delivery).toLocaleDateString()}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function MyOrders() {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const { isMobile } = useResponsive();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedOrdersRef = useRef<TrackedOrderRef[]>([]);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [orderNumberFilter, setOrderNumberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  // Filter options
  const STATUS_OPTIONS = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const DATE_RANGE_OPTIONS = [
    { value: 'all', label: 'All Time' },
    { value: '7', label: 'Last 7 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 3 Months' },
    { value: '365', label: 'Last Year' },
  ];

  // Apply filters to orders
  const filteredOrders = orders.filter(order => {
    // Order number filter
    if (orderNumberFilter.trim()) {
      const searchTerm = orderNumberFilter.toLowerCase().trim();
      if (!order.order_number.toLowerCase().includes(searchTerm)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }

    // Date range filter
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const orderDate = new Date(order.created_at);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      if (orderDate < cutoffDate) {
        return false;
      }
    }

    return true;
  });

  // Check if any filters are active
  const hasActiveFilters = orderNumberFilter.trim() !== '' || statusFilter !== 'all' || dateRange !== 'all';

  // Clear all filters
  const clearFilters = () => {
    setOrderNumberFilter('');
    setStatusFilter('all');
    setDateRange('all');
  };

  // Fetch orders for all saved order number + token pairs
  const refreshTrackedOrders = useCallback(async (isRefresh = false) => {
    const refs = trackedOrdersRef.current;
    if (refs.length === 0) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
      setSearched(true);
    }

    try {
      const fetchedOrders: Order[] = [];
      for (const ref of refs) {
        const { response, data } = await lookupOrderByToken(ref.orderNumber, ref.token);
        if (response.ok && data.success && data.data) {
          fetchedOrders.push(normalizeOrder(data.data));
        }
      }

      if (!isRefresh && fetchedOrders.length === 0) {
        setError('No orders found. Check your order number and access token.');
        toast.info('No orders found', {
          description: 'Verify your order number and access token from your confirmation email.',
          duration: 5000,
        });
      }

      if (isRefresh) {
        setOrders((prev) => {
          fetchedOrders.forEach((newOrder) => {
            const oldOrder = prev.find((o) => o.id === newOrder.id);
            if (oldOrder && oldOrder.status !== newOrder.status) {
              toast.success('Order Updated!', {
                description: `Order #${newOrder.order_number.slice(-8)} is now ${newOrder.status}`,
              });
            }
          });
          return fetchedOrders;
        });
      } else {
        setOrders(fetchedOrders);
      }

      setLastUpdated(new Date());
    } catch (err) {
      logError('Error fetching orders:', err);
      if (!isRefresh) {
        const errorMsg = 'Failed to connect to server. Please check your connection and try again.';
        setError(errorMsg);
        toast.error('Connection error', { description: errorMsg, duration: 6000 });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const lookupOrder = useCallback(async (orderNum: string, token: string) => {
    if (!orderNum.trim() || !token.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const { response, data } = await lookupOrderByToken(orderNum, token);

      if (response.ok && data.success && data.data) {
        const ref = { orderNumber: orderNum.trim(), token: token.trim() };
        saveTrackedOrder(ref);
        trackedOrdersRef.current = getTrackedOrders();
        const normalized = normalizeOrder(data.data);
        setOrders((prev) => {
          const without = prev.filter((o) => o.id !== normalized.id);
          return [normalized, ...without];
        });
        setLastUpdated(new Date());
      } else {
        const errorMessage =
          data.message || data.error || 'Invalid order number or access token';
        setError(errorMessage);
        toast.error('Order not found', { description: errorMessage, duration: 6000 });
        setOrders([]);
      }
    } catch (err) {
      logError('Error fetching order:', err);
      const errorMsg = 'Failed to connect to server. Please check your connection and try again.';
      setError(errorMsg);
      toast.error('Connection error', { description: errorMsg, duration: 6000 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    trackedOrdersRef.current = getTrackedOrders();
    const urlOrderNumber = searchParams.get('orderNumber');
    const urlToken = searchParams.get('token');

    if (urlOrderNumber && urlToken) {
      setOrderNumber(urlOrderNumber);
      setAccessToken(urlToken);
      void lookupOrder(urlOrderNumber, urlToken);
    } else if (trackedOrdersRef.current.length > 0) {
      void refreshTrackedOrders(false);
    }
  }, [searchParams, lookupOrder, refreshTrackedOrders]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && searched && trackedOrdersRef.current.length > 0) {
      refreshIntervalRef.current = setInterval(() => {
        void refreshTrackedOrders(true);
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, searched, refreshTrackedOrders]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderNumber.trim()) {
      toast.error('Order number required', {
        description: 'Enter the order number from your confirmation email',
      });
      return;
    }

    if (!accessToken.trim()) {
      toast.error('Access token required', {
        description: 'Enter the access token from your confirmation email',
      });
      return;
    }

    await lookupOrder(orderNumber, accessToken);
  };

  const handleManualRefresh = () => {
    if (trackedOrdersRef.current.length > 0) {
      void refreshTrackedOrders(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return '#10b981';
      case 'shipped': return '#9c6649';
      case 'processing': return '#f59e0b';
      case 'pending': return '#6b7280';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle size={20} />;
      case 'shipped': return <Truck size={20} />;
      case 'processing': return <Package size={20} />;
      case 'pending': return <Clock size={20} />;
      case 'cancelled': return <XCircle size={20} />;
      default: return <Package size={20} />;
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'delivered': return 'Your order has been delivered';
      case 'shipped': return 'Your order is on the way';
      case 'processing': return 'We\'re preparing your order';
      case 'pending': return 'Awaiting confirmation';
      case 'cancelled': return 'Order has been cancelled';
      default: return '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBlueDartTrackingUrl = (trackingNumber: string) => {
    return `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${trackingNumber}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
      padding: isMobile ? '20px' : '40px 20px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 10px 40px rgba(156, 102, 73, 0.3)',
          }}>
            <Package size={40} color="white" />
          </div>
          <h1 style={{
            fontSize: isMobile ? 32 : 42,
            fontWeight: 900,
            color: '#1f2937',
            marginBottom: 12,
          }}>
            Track Your Orders
          </h1>
          <p style={{
            fontSize: 16,
            color: '#6b7280',
            maxWidth: 600,
            margin: '0 auto',
          }}>
            Enter your order number and access token from your confirmation email to track deliveries
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'white',
            borderRadius: 16,
            padding: isMobile ? 24 : 32,
            marginBottom: 32,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        >
          <form onSubmit={handleSearch}>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8,
            }}>
              Order Number
            </label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Hash style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
              }} size={20} />
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="GSS-1234567890-ABCDEF"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => e.target.style.borderColor = '#9c6649'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8,
            }}>
              Access Token
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: isMobile ? '100%' : 'auto' }}>
                <KeyRound style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                }} size={20} />
                <input
                  type="text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Paste token from confirmation email"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 16,
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#9c6649'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  background: loading ? '#9ca3af' : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(156, 102, 73, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Search size={20} />
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {error && (
              <p style={{
                marginTop: 12,
                color: '#ef4444',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <AlertCircle size={16} />
                {error}
              </p>
            )}
          </form>
        </motion.div>

        {/* Filters Section */}
        {searched && orders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: isMobile ? 16 : 20,
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Filter Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: showFilters ? 16 : 0,
            }}>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: showFilters ? 'linear-gradient(135deg, #361906 0%, #9c6649 100%)' : '#f3f4f6',
                  color: showFilters ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Filter size={18} />
                Filters
                {hasActiveFilters && !showFilters && (
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ef4444',
                  }} />
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    background: 'transparent',
                    color: '#ef4444',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                  Clear Filters
                </button>
              )}
            </div>

            {/* Filter Controls */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: 16,
                }}
              >
                {/* Order Number Search */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8,
                  }}>
                    Order Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Hash style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                    }} size={18} />
                    <input
                      type="text"
                      value={orderNumberFilter}
                      onChange={(e) => setOrderNumberFilter(e.target.value)}
                      placeholder="Search by order #"
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 40px',
                        border: '2px solid #e5e7eb',
                        borderRadius: 10,
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8,
                  }}>
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 10,
                      fontSize: 14,
                      outline: 'none',
                      background: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Date Range Filter */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8,
                  }}>
                    Date Range
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 10,
                      fontSize: 14,
                      outline: 'none',
                      background: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    {DATE_RANGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}

            {/* Filter Results Summary */}
            {hasActiveFilters && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: '#f0fdf4',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <CheckCircle size={16} color="#10b981" />
                <span style={{ fontSize: 13, color: '#047857' }}>
                  Showing {filteredOrders.length} of {orders.length} orders
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Real-time Controls & Status */}
        {searched && orders.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              fontSize: 14,
              color: '#6b7280',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {refreshing && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <RefreshCw size={14} />
                  </motion.div>
                )}
                {lastUpdated && !refreshing && (
                  <>Last updated: {formatTime(lastUpdated)}</>
                )}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Auto-refresh toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 14,
                color: '#6b7280',
              }}>
                <div 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: autoRefresh ? '#10b981' : '#e5e7eb',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer',
                  }}
                >
                  <motion.div
                    animate={{ x: autoRefresh ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>
                <span>Auto-refresh</span>
              </label>
              
              {/* Manual refresh button */}
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                style={{
                  padding: '8px 16px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: refreshing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: refreshing ? '#9ca3af' : '#374151',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!refreshing) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <motion.div
                  animate={refreshing ? { rotate: 360 } : {}}
                  transition={{ repeat: refreshing ? Infinity : 0, duration: 1, ease: 'linear' }}
                >
                  <RefreshCw size={16} />
                </motion.div>
                Refresh
              </button>
            </div>
          </motion.div>
        )}

        {/* Loading State with Skeletons */}
        {loading && (
          <OrdersListSkeleton count={3} isMobile={isMobile} />
        )}

        {/* No Orders Found */}
        {searched && !loading && orders.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 60,
              textAlign: 'center',
            }}
          >
            <Package size={64} color="#d1d5db" style={{ margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
              No Orders Found
            </h3>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              We couldn't find an order with those credentials. Check your confirmation email.
            </p>
          </motion.div>
        )}

        {/* No Orders Match Filters */}
        {searched && !loading && orders.length > 0 && filteredOrders.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 40,
              textAlign: 'center',
            }}
          >
            <Filter size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
              No Orders Match Your Filters
            </h3>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              Try adjusting your filters to see more orders
            </p>
            <button
              onClick={clearFilters}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear All Filters
            </button>
          </motion.div>
        )}

        {/* Orders List */}
        <AnimatePresence>
          {filteredOrders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: isMobile ? 20 : 24,
                marginBottom: 16,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              {/* Order Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 20,
                flexWrap: 'wrap',
                gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    Order #{order.order_number.slice(-12)}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2937' }}>
                    ${order.total.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                    Placed on {formatDate(order.created_at)}
                  </div>
                </div>
                
                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    background: `${getStatusColor(order.status)}15`,
                    color: getStatusColor(order.status),
                    borderRadius: 24,
                    fontWeight: 600,
                    fontSize: 14,
                  }}>
                    {getStatusIcon(order.status)}
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    marginTop: 6,
                  }}>
                    {getStatusDescription(order.status)}
                  </div>
                </div>
              </div>

              {/* Visual Timeline */}
              <OrderTimeline order={order} isMobile={isMobile} />

              {/* Tracking Info - Enhanced */}
              {order.tracking_number && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{
                    background: 'linear-gradient(135deg, #f5e0d5 0%, #e8c9b8 100%)',
                    borderRadius: 12,
                    padding: isMobile ? 16 : 20,
                    marginBottom: 16,
                    border: '1px solid #9c6649',
                  }}
                >
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#7c3aed',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Truck size={18} />
                    Shipment Details
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#6b7280', 
                        marginBottom: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Tracking Number
                      </div>
                      <div style={{ 
                        fontSize: 18, 
                        fontWeight: 700, 
                        color: '#1f2937',
                        fontFamily: 'monospace',
                        letterSpacing: '0.1em',
                      }}>
                        {order.tracking_number}
                      </div>
                      <div style={{ 
                        fontSize: 13, 
                        color: '#7c3aed', 
                        marginTop: 4,
                        fontWeight: 500,
                      }}>
                        via {order.carrier || 'Blue Dart'}
                      </div>
                    </div>
                    
                    <a
                      href={order.tracking_url || getBlueDartTrackingUrl(order.tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <Truck size={18} />
                      Track Package
                      <ExternalLink size={16} />
                    </a>
                  </div>
                  
                  {order.estimated_delivery && (
                    <div style={{
                      marginTop: 16,
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <Calendar size={18} color="#7c3aed" />
                      <div>
                        <span style={{ fontSize: 13, color: '#6b7280' }}>Expected Delivery: </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                          {formatDate(order.estimated_delivery)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {order.delivered_at && (
                    <div style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}>
                      <CheckCircle size={18} color="#10b981" />
                      <div>
                        <span style={{ fontSize: 13, color: '#6b7280' }}>Delivered on: </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>
                          {formatDate(order.delivered_at)}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Items Preview */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Items ({order.items.length})
                </div>
                {order.items.slice(0, expandedOrder === order.id ? undefined : 2).map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6',
                  }}>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      {item.product_name} × {item.quantity}
                      {item.size_system && (
                        <span style={{ fontSize: 12, marginLeft: 8 }}>
                          (Size: {item.size_system} {item.size_value})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expand/Collapse Button */}
              {order.items.length > 2 && (
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#9c6649',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {expandedOrder === order.id ? (
                    <>Show Less <ChevronUp size={16} /></>
                  ) : (
                    <>Show All Items <ChevronDown size={16} /></>
                  )}
                </button>
              )}

              {/* Shipping Address */}
              {expandedOrder === order.id && order.shipping_address && (
                <div style={{
                  marginTop: 16,
                  padding: 16,
                  background: '#f9fafb',
                  borderRadius: 8,
                }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <MapPin size={16} />
                    Shipping Address
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                    {order.shipping_address.fullName || order.shipping_address.full_name}<br />
                    {order.shipping_address.address}<br />
                    {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zipCode || order.shipping_address.zip_code}<br />
                    {order.shipping_address.country}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

