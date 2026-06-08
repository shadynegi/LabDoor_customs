// AdminDashboard.tsx - Enhanced Admin panel with analytics, bulk actions, and product management
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  DollarSign,
  TrendingUp,
  Search,
  Mail,
  Truck,
  Eye,
  RefreshCw,
  LogOut,
  BarChart3,
  ShoppingBag,
  MessageSquare,
  Users,
  Globe,
  AlertTriangle,
  X,
  MapPinned,
  Plus,
  Pencil,
  Trash2,
  Tag,
  CheckCircle,
  Ban,
  Send,
  Star,
} from 'lucide-react';
import { apiFetch, catalogFetch, slowApiFetch } from '../config';
import { useResponsive } from '../hooks/useResponsive';
import { toast } from 'sonner';
import LiquidModal from '../components/LiquidModal';
import AdminProductFormModal, { type AdminProduct } from '../components/AdminProductFormModal';
import AdminCouponsTab from '../components/AdminCouponsTab';
import AdminReviewsTab from '../components/AdminReviewsTab';
import AdminActionDialog from '../components/AdminActionDialog';
import { clearProductCatalogCache } from '../lib/productCatalogCache';
import { DashboardSkeleton, SkeletonStyles } from '../components/Skeletons';
import { logError } from '../lib/logger';

// Types
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
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  paypal_order_id?: string;
  paypal_capture_id?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  estimated_delivery?: string;
  created_at: string;
  updated_at: string;
}

type Product = AdminProduct & {
  rating?: number;
  review_count?: number;
  view_count?: number;
  cart_count?: number;
};

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  created_at: string;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  first_order_date: string;
  is_deleted?: boolean;
}

interface Analytics {
  orders: any;
  products: any;
  topViewedProducts: any[];
  topCartedProducts: any[];
  customerLocations: any[];
  countrySummary: any[];
  recentOrders: any[];
  dailyTrend: any[];
  messages: any;
  customers: any;
  integrations?: {
    ga4?: { configured: boolean; measurementId: string | null; consoleUrl: string };
    searchConsole?: { configured: boolean; siteUrl: string | null; consoleUrl: string };
  };
}

type Tab = 'analytics' | 'products' | 'orders' | 'messages' | 'customers' | 'coupons' | 'reviews';

type AdminDialog =
  | { kind: 'markPaid'; orderId: string }
  | { kind: 'cancelOrder'; orderId: string }
  | { kind: 'deleteCustomer'; customer: Customer }
  | { kind: 'deleteProduct'; product: Product }
  | null;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const { isMobile } = useResponsive();
  const adminHeaderRef = useRef<HTMLDivElement>(null);
  const [adminHeaderHeight, setAdminHeaderHeight] = useState(isMobile ? 72 : 80);

  useEffect(() => {
    const el = adminHeaderRef.current;
    if (!el) return;

    const measure = () => setAdminHeaderHeight(el.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile]);

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotalPages, setProductsTotalPages] = useState(1);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderActionLoading, setOrderActionLoading] = useState(false);
  const [orderTrackingNumber, setOrderTrackingNumber] = useState('');
  const [orderTrackingUrl, setOrderTrackingUrl] = useState('');
  const [orderCarrier, setOrderCarrier] = useState('Blue Dart');
  const [orderEstimatedDelivery, setOrderEstimatedDelivery] = useState('');
  const [showDeletedCustomers, setShowDeletedCustomers] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  
  // Filter states
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<typeof products | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [messageStatusFilter, setMessageStatusFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Bulk selection states
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminDialog, setAdminDialog] = useState<AdminDialog>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductSearchResults(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const response = await catalogFetch('/products/search', {
          method: 'POST',
          body: JSON.stringify({
            query: productSearch.trim(),
            limit: 50,
            page: 1,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setProductSearchResults(
            (data.data || []).map((p: { id: number; name: string; price: string | number; stock?: number; is_out_of_stock?: boolean }) => ({
              ...p,
              price: parseFloat(String(p.price)),
              is_out_of_stock: p.is_out_of_stock || false,
            }))
          );
        }
      } catch (error) {
        logError('Admin product search failed:', error);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [productSearch]);

  const loadData = async () => {
    if (activeTab === 'coupons' || activeTab === 'reviews') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      switch (activeTab) {
        case 'analytics':
          await fetchAnalytics();
          break;
        case 'orders':
          await fetchOrders();
          break;
        case 'products':
          await fetchProducts(1, false);
          break;
        case 'messages':
          await fetchMessages();
          break;
        case 'customers':
          await fetchCustomers();
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsError(null);
    try {
      const response = await slowApiFetch('/admin/analytics', {
        retry: { count: 1, on: [502, 503, 504] },
      });
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        setAnalytics(null);
        setAnalyticsError(data.error || 'Failed to load analytics');
        toast.error(data.error || 'Failed to load analytics');
      }
    } catch (error) {
      logError('Error fetching analytics:', error);
      setAnalytics(null);
      setAnalyticsError('Unable to load analytics. Check your connection and try again.');
      toast.error('Failed to load analytics');
    }
  };

  const fetchOrders = async (page = ordersPage, search = orderSearch) => {
    setOrdersError(null);
    try {
      const statusQuery = orderStatusFilter !== 'all' ? `&status=${orderStatusFilter}` : '';
      const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const response = await apiFetch(`/orders?limit=50&page=${page}${statusQuery}${searchQuery}`);
      const data = await response.json();
      if (data.success) {
        const parsed = (data.data || []).map((o: any) => ({
          ...o,
          subtotal: parseFloat(o.subtotal),
          shipping_cost: parseFloat(o.shipping_cost),
          tax: parseFloat(o.tax),
          total: parseFloat(o.total),
          items: (o.items || []).map((i: any) => ({ ...i, price: parseFloat(i.price) })),
        }));
        setOrders(parsed);
        setOrdersTotal(data.count ?? parsed.length);
        setOrdersTotalPages(data.pagination?.totalPages ?? 1);
        setOrdersPage(data.pagination?.page ?? page);
      } else {
        setOrdersError(data.error || 'Failed to load orders');
      }
    } catch (error) {
      logError('Error fetching orders:', error);
      setOrdersError('Unable to load orders. Check your connection and try again.');
      toast.error('Failed to load orders');
    }
  };

  const fetchProducts = async (page = 1, append = false) => {
    if (append) {
      setProductsLoadingMore(true);
    } else {
      setProductsError(null);
    }
    try {
      const response = await catalogFetch(`/products?limit=50&page=${page}`);
      const data = await response.json();
      if (data.success) {
        const parsed = (data.data || []).map((p: any) => ({
          ...p,
          price: parseFloat(p.price),
          is_out_of_stock: p.is_out_of_stock || false,
        }));
        setProducts((prev) => (append ? [...prev, ...parsed] : parsed));
        setProductsPage(data.pagination?.page ?? page);
        setProductsTotalPages(data.pagination?.totalPages ?? 1);
        setProductsTotal(data.pagination?.total ?? parsed.length);
      } else {
        const err = data.error || 'Failed to load products';
        setProductsError(err);
        if (!append) setProducts([]);
        toast.error(err);
      }
    } catch (error) {
      logError('Error fetching products:', error);
      const err = 'Unable to load products. Check your connection and try again.';
      setProductsError(err);
      if (!append) setProducts([]);
      toast.error(err);
    } finally {
      setProductsLoadingMore(false);
    }
  };

  const fetchMessages = async () => {
    setMessagesError(null);
    try {
      const response = await apiFetch('/contact', {
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.data || []);
      } else {
        const err = data.error || 'Failed to load messages';
        setMessagesError(err);
        setMessages([]);
        toast.error(err);
      }
    } catch (error) {
      logError('Error fetching messages:', error);
      const err = 'Unable to load messages. Check your connection and try again.';
      setMessagesError(err);
      setMessages([]);
      toast.error(err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const deletedQuery = showDeletedCustomers ? '&include_deleted=true' : '';
      const response = await apiFetch(`/admin/customers?limit=100${deletedQuery}`);
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data || []);
      }
    } catch (error) {
      logError('Error fetching customers:', error);
      toast.error('Failed to load customers');
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      setOrderTrackingNumber(selectedOrder.tracking_number || '');
      setOrderTrackingUrl(selectedOrder.tracking_url || '');
      setOrderCarrier(selectedOrder.carrier || 'Blue Dart');
      setOrderEstimatedDelivery(
        selectedOrder.estimated_delivery ? selectedOrder.estimated_delivery.slice(0, 10) : ''
      );
    }
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomers();
    }
  }, [showDeletedCustomers]);

  const skipOrderSearchDebounce = useRef(true);
  useEffect(() => {
    if (activeTab !== 'orders') {
      skipOrderSearchDebounce.current = true;
      return;
    }
    if (skipOrderSearchDebounce.current) {
      skipOrderSearchDebounce.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setOrdersPage(1);
      fetchOrders(1, orderSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [orderSearch, activeTab]);

  const refreshSelectedOrder = async (orderId: string) => {
    const response = await apiFetch(`/orders/${orderId}`);
    const data = await response.json();
    if (data.success && data.data) {
      const o = data.data;
      const parsed: Order = {
        ...o,
        subtotal: parseFloat(o.subtotal),
        shipping_cost: parseFloat(o.shipping_cost),
        tax: parseFloat(o.tax),
        total: parseFloat(o.total),
        items: (o.items || []).map((i: any) => ({ ...i, price: parseFloat(i.price) })),
      };
      setSelectedOrder(parsed);
      setOrders((prev) => prev.map((row) => (row.id === orderId ? parsed : row)));
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, status: Order['status']) => {
    setOrderActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Order marked ${status}`);
        await refreshSelectedOrder(orderId);
        fetchOrders(ordersPage);
      } else {
        toast.error(data.message || data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setOrderActionLoading(false);
    }
  };

  const executeMarkPaid = async (orderId: string, paymentId: string, adminNote: string) => {
    setOrderActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}/payment-status`, {
        method: 'PATCH',
        body: JSON.stringify({
          payment_status: 'completed',
          payment_id: paymentId,
          admin_note: adminNote,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Payment marked completed');
        await refreshSelectedOrder(orderId);
        fetchOrders(ordersPage);
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setOrderActionLoading(false);
    }
  };

  const handleSaveTracking = async (orderId: string) => {
    if (!orderTrackingNumber.trim()) {
      toast.error('Tracking number is required');
      return;
    }
    setOrderActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          tracking_number: orderTrackingNumber.trim(),
          tracking_url: orderTrackingUrl.trim() || undefined,
          carrier: orderCarrier.trim() || 'Blue Dart',
          estimated_delivery: orderEstimatedDelivery.trim() || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Tracking saved');
        await refreshSelectedOrder(orderId);
        fetchOrders(ordersPage);
      } else {
        toast.error(data.error || 'Failed to save tracking');
      }
    } catch {
      toast.error('Failed to save tracking');
    } finally {
      setOrderActionLoading(false);
    }
  };

  const handleNotifyShipped = async (orderId: string) => {
    setOrderActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}/notify-shipped`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast.success('Shipping notification sent');
      } else {
        toast.error(data.error || 'Failed to send notification');
      }
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setOrderActionLoading(false);
    }
  };

  const executeCancelOrder = async (orderId: string, reason?: string) => {
    setOrderActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason, process_refund: true }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || 'Order cancelled');
        await refreshSelectedOrder(orderId);
        fetchOrders(ordersPage);
      } else {
        toast.error(data.message || data.error || 'Cancellation failed');
      }
    } catch {
      toast.error('Cancellation failed');
    } finally {
      setOrderActionLoading(false);
    }
  };

  const executeDeleteCustomer = async (customer: Customer) => {
    try {
      const response = await apiFetch(`/admin/customers/${customer.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('Customer deleted');
        fetchCustomers();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleRestoreCustomer = async (customer: Customer) => {
    try {
      const response = await apiFetch(`/admin/customers/${customer.id}/restore`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast.success('Customer restored');
        fetchCustomers();
      } else {
        toast.error(data.error || 'Restore failed');
      }
    } catch {
      toast.error('Restore failed');
    }
  };

  const fetchCustomerHistory = async (email: string) => {
    setCustomerHistoryLoading(true);
    try {
      const response = await apiFetch(`/admin/customers/${encodeURIComponent(email)}`, {
      });
      const data = await response.json();
      if (data.success) {
        setCustomerOrders(data.data.orders || []);
      } else {
        toast.error(data.error || 'Failed to load customer history');
        setCustomerOrders([]);
      }
    } catch (error) {
      logError('Error fetching customer history:', error);
      toast.error('Failed to load customer history');
      setCustomerOrders([]);
    } finally {
      setCustomerHistoryLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/admin/logout', { method: 'POST' });
    } catch {
      // Continue with client redirect even if logout request fails
    }
    toast.success('Logged out successfully');
    navigate('/admin/login');
  };

  // Bulk actions
  const handleBulkProductUpdate = async (updates: { is_out_of_stock?: boolean }) => {
    if (selectedProducts.size === 0) {
      toast.error('No products selected');
      return;
    }
    try {
      const response = await apiFetch('/admin/products/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ productIds: Array.from(selectedProducts), updates }),
      });
      const data = await response.json();
      if (data.success) {
        clearProductCatalogCache();
        toast.success(`Updated ${data.updatedCount} products`);
        setSelectedProducts(new Set());
        fetchProducts();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleBulkOrderUpdate = async (updates: { status?: string }) => {
    if (selectedOrders.size === 0) {
      toast.error('No orders selected');
      return;
    }
    try {
      const response = await apiFetch('/admin/orders/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ orderIds: Array.from(selectedOrders), updates }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Updated ${data.updatedCount} orders`);
        setSelectedOrders(new Set());
        fetchOrders();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const updateMessageStatus = async (messageId: string, status: ContactMessage['status']) => {
    try {
      const response = await apiFetch(`/contact/${messageId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status } : m))
        );
        setSelectedMessage((prev) =>
          prev && prev.id === messageId ? { ...prev, status } : prev
        );
        toast.success(`Message marked ${status}`);
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    }
  };

  const openMessage = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (msg.status === 'new') {
      await updateMessageStatus(msg.id, 'read');
    }
  };

  const handleBulkMessageUpdate = async (status: string) => {
    if (selectedMessages.size === 0) {
      toast.error('No messages selected');
      return;
    }
    try {
      const response = await apiFetch('/admin/messages/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ messageIds: Array.from(selectedMessages), updates: { status } }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Updated ${data.updatedCount} messages`);
        setSelectedMessages(new Set());
        fetchMessages();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const toggleProductStock = async (productId: number, currentStatus: boolean) => {
    try {
      const response = await apiFetch(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_out_of_stock: !currentStatus }),
      });
      const data = await response.json();
      if (data.success) {
        clearProductCatalogCache();
        toast.success(`Product marked as ${!currentStatus ? 'out of stock' : 'in stock'}`);
        fetchProducts();
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductFormOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductFormOpen(true);
  };

  const executeDeleteProduct = async (product: Product) => {
    try {
      const response = await apiFetch(`/products/${product.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        clearProductCatalogCache();
        toast.success('Product deleted');
        fetchProducts();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  // Filter functions
  const filteredOrders = orders;

  const filteredProducts = productSearchResults ?? products.filter((p) => {
    return !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase());
  });

  const filteredMessages = messages.filter(m => {
    return messageStatusFilter === 'all' || m.status === messageStatusFilter;
  });

  const filteredCustomers = customers.filter(c => {
    return !customerSearch || 
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.name?.toLowerCase().includes(customerSearch.toLowerCase());
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b', processing: '#9c6649', shipped: '#9c6649',
      delivered: '#10b981', cancelled: '#ef4444', completed: '#10b981',
      failed: '#ef4444', refunded: '#6b7280', new: '#9c6649',
      read: '#f59e0b', replied: '#10b981', archived: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  // Tab content components
  const StatCard = ({ icon: Icon, title, value, color, subtitle }: any) => (
    <div style={{
      background: 'white', borderRadius: 16, padding: isMobile ? 16 : 24,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ background: `${color}15`, padding: 12, borderRadius: 12 }}>
          <Icon size={24} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{title}</p>
          <h3 style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 800, color: '#1f2937' }}>{value}</h3>
          {subtitle && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => {
    if (analyticsError) {
      return (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <AlertTriangle size={40} color="#dc2626" style={{ marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>Analytics unavailable</h3>
          <p style={{ margin: '0 0 20px', color: '#6b7280' }}>{analyticsError}</p>
          <button
            type="button"
            onClick={fetchAnalytics}
            style={{ padding: '10px 20px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      );
    }

    if (!analytics) {
      return (
        <>
          <SkeletonStyles />
          <DashboardSkeleton isMobile={isMobile} />
        </>
      );
    }

    return (
      <div>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard icon={Package} title="Total Orders" value={analytics.orders.total_orders} color="#9c6649" subtitle="All time" />
          <StatCard icon={DollarSign} title="Total Revenue" value={`$${analytics.orders.total_revenue.toFixed(2)}`} color="#10b981" subtitle="All time" />
          <StatCard icon={TrendingUp} title="Orders (30d)" value={analytics.orders.orders_last_30_days} color="#9c6649" subtitle={`$${analytics.orders.revenue_last_30_days.toFixed(2)} revenue`} />
          <StatCard icon={Users} title="Customers" value={analytics.customers.total_customers} color="#9c6649" subtitle={`${analytics.customers.new_customers_30_days} new (30d)`} />
        </div>

        {/* Product Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard icon={ShoppingBag} title="Products" value={analytics.products.total_products} color="#f59e0b" />
          <StatCard icon={AlertTriangle} title="Out of Stock" value={analytics.products.out_of_stock_products} color="#ef4444" />
          <StatCard icon={Eye} title="Product Views" value={analytics.products.total_views} color="#06b6d4" />
          <StatCard icon={ShoppingBag} title="Cart Adds" value={analytics.products.total_cart_adds} color="#9c6649" />
        </div>

        {/* Top Products */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, marginBottom: 32 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Top Viewed Products</h3>
            {analytics.topViewedProducts.map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < analytics.topViewedProducts.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ color: '#6b7280' }}>{p.view_count} views</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Most Added to Cart</h3>
            {analytics.topCartedProducts.map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < analytics.topCartedProducts.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ color: '#6b7280' }}>{p.cart_count} adds</span>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Locations */}
        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 32 }}>
          <h3 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={20} /> Customer Locations
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {analytics.countrySummary.map((loc: any, i: number) => (
              <div key={i} style={{ background: '#f9fafb', padding: 16, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <MapPinned size={16} color="#9c6649" />
                  <span style={{ fontWeight: 600 }}>{loc.country || 'Unknown'}</span>
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {loc.order_count} orders • ${parseFloat(loc.total_revenue).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* External analytics integrations */}
        {analytics.integrations && (
          <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 700 }}>External Analytics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Google Analytics 4</div>
                <div style={{ fontSize: 14, color: analytics.integrations.ga4?.configured ? '#059669' : '#6b7280', marginBottom: 12 }}>
                  {analytics.integrations.ga4?.configured
                    ? `Configured (${analytics.integrations.ga4.measurementId})`
                    : 'Not configured — set VITE_GA4_MEASUREMENT_ID and GA4_MEASUREMENT_ID'}
                </div>
                <a
                  href={analytics.integrations.ga4?.consoleUrl || 'https://analytics.google.com/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#9c6649', fontWeight: 600, fontSize: 14 }}
                >
                  Open GA4 Console →
                </a>
              </div>
              <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Google Search Console</div>
                <div style={{ fontSize: 14, color: analytics.integrations.searchConsole?.configured ? '#059669' : '#6b7280', marginBottom: 12 }}>
                  {analytics.integrations.searchConsole?.configured
                    ? `Site: ${analytics.integrations.searchConsole.siteUrl}`
                    : 'Set VITE_GSC_VERIFICATION and GSC_SITE_URL'}
                </div>
                <a
                  href={analytics.integrations.searchConsole?.consoleUrl || 'https://search.google.com/search-console'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#9c6649', fontWeight: 600, fontSize: 14 }}
                >
                  Open Search Console →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProducts = () => (
    <div>
      {productsError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#991b1b', fontSize: 14 }}>{productsError}</span>
          <button type="button" onClick={() => fetchProducts(1, false)} style={{ padding: '8px 14px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          Showing {products.length} of {productsTotal} products
        </span>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
          />
        </div>
        <button onClick={() => setSelectedProducts(new Set(filteredProducts.map(p => p.id)))} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Select All
        </button>
        <button onClick={() => setSelectedProducts(new Set())} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Clear
        </button>
        {selectedProducts.size > 0 && (
          <>
            <button onClick={() => handleBulkProductUpdate({ is_out_of_stock: true })} style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Mark Out of Stock ({selectedProducts.size})
            </button>
            <button onClick={() => handleBulkProductUpdate({ is_out_of_stock: false })} style={{ padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Mark In Stock ({selectedProducts.size})
            </button>
          </>
        )}
        <button
          onClick={openCreateProduct}
          style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}
        >
          <Plus size={16} /> Add Shoe
        </button>
      </div>

      {/* Products — cards on mobile, table on desktop */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredProducts.map((product) => (
            <div key={product.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={selectedProducts.has(product.id)}
                  onChange={(e) => {
                    const newSet = new Set(selectedProducts);
                    e.target.checked ? newSet.add(product.id) : newSet.delete(product.id);
                    setSelectedProducts(newSet);
                  }}
                  style={{ marginTop: 4, minWidth: 20, minHeight: 20 }}
                />
                {product.image && (
                  <img src={product.image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1f2937' }}>{product.name}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    ${product.price.toFixed(2)} · Stock {product.stock} · {product.size || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => toggleProductStock(product.id, product.is_out_of_stock)}
                      style={{ padding: '8px 12px', minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer', background: product.is_out_of_stock ? '#fee2e2' : '#dcfce7', color: product.is_out_of_stock ? '#dc2626' : '#16a34a', fontWeight: 600, fontSize: 13 }}>
                      {product.is_out_of_stock ? 'Out of Stock' : 'In Stock'}
                    </button>
                    <button type="button" onClick={() => openEditProduct(product)} style={{ padding: 8, minHeight: 44, minWidth: 44, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                      <Pencil size={16} color="#374151" />
                    </button>
                    <button type="button" onClick={() => setAdminDialog({ kind: 'deleteProduct', product })} style={{ padding: 8, minHeight: 44, minWidth: 44, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                      <Trash2 size={16} color="#dc2626" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="responsive-table-wrap" style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', width: 40 }}>
                <input type="checkbox" checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                  onChange={(e) => setSelectedProducts(e.target.checked ? new Set(filteredProducts.map(p => p.id)) : new Set())} />
              </th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Product</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Size</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Price</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Stock</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Views</th>
              <th style={{ padding: 16, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151' }}>Status</th>
              <th style={{ padding: 16, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: 16 }}>
                  <input type="checkbox" checked={selectedProducts.has(product.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedProducts);
                      e.target.checked ? newSet.add(product.id) : newSet.delete(product.id);
                      setSelectedProducts(newSet);
                    }} />
                </td>
                <td style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {product.image && (
                      <img
                        src={product.image}
                        alt=""
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, background: '#f3f4f6' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: '#1f2937' }}>{product.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {[product.category, product.color].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: 16, color: '#374151', fontWeight: 500 }}>{product.size || '—'}</td>
                <td style={{ padding: 16, fontWeight: 600, color: '#10b981' }}>${product.price.toFixed(2)}</td>
                <td style={{ padding: 16 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                    background: product.stock === 0 ? '#fee2e2' : product.stock < 10 ? '#fef3c7' : '#dcfce7',
                    color: product.stock === 0 ? '#dc2626' : product.stock < 10 ? '#d97706' : '#16a34a' }}>
                    {product.stock}
                  </span>
                </td>
                <td style={{ padding: 16, color: '#6b7280' }}>{product.view_count || 0}</td>
                <td style={{ padding: 16, textAlign: 'center' }}>
                  <button onClick={() => toggleProductStock(product.id, product.is_out_of_stock)}
                    title={product.is_out_of_stock ? 'Mark in stock' : 'Mark out of stock'}
                    style={{ width: 40, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: product.is_out_of_stock ? '#ef4444' : '#10b981', position: 'relative' }}>
                    <span style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: 'white', top: 3,
                      left: product.is_out_of_stock ? 19 : 3, transition: 'left 0.2s' }} />
                  </button>
                </td>
                <td style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => openEditProduct(product)}
                      title="Edit"
                      style={{ padding: 8, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <Pencil size={16} color="#374151" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminDialog({ kind: 'deleteProduct', product })}
                      title="Delete"
                      style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {productsPage < productsTotalPages && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button
            type="button"
            disabled={productsLoadingMore}
            onClick={() => fetchProducts(productsPage + 1, true)}
            style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: productsLoadingMore ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            {productsLoadingMore ? 'Loading…' : `Load more (${products.length} of ${productsTotal})`}
          </button>
        </div>
      )}
    </div>
  );

  const renderOrders = () => (
    <div>
      {ordersError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#b91c1c', fontSize: 14 }}>{ordersError}</span>
          <button type="button" onClick={() => fetchOrders(ordersPage, orderSearch)}
            style={{ padding: '8px 14px', background: 'white', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search orders..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
        </div>
        <select value={orderStatusFilter} onChange={(e) => { setOrderStatusFilter(e.target.value); setOrdersPage(1); fetchOrders(1, orderSearch); }}
          style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setSelectedOrders(new Set(filteredOrders.map(o => o.id)))} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Select All</button>
        <button onClick={() => setSelectedOrders(new Set())} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Clear</button>
        {selectedOrders.size > 0 && (
          <select onChange={(e) => { if (e.target.value) handleBulkOrderUpdate({ status: e.target.value }); e.target.value = ''; }}
            style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600 }}>
            <option value="">Bulk Update ({selectedOrders.size})</option>
            <option value="processing">Mark Processing</option>
            <option value="shipped">Mark Shipped</option>
            <option value="delivered">Mark Delivered</option>
          </select>
        )}
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {ordersTotal} orders · page {ordersPage} of {ordersTotalPages}
        </span>
        <button
          type="button"
          disabled={ordersPage <= 1}
          onClick={() => fetchOrders(ordersPage - 1)}
          style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: ordersPage <= 1 ? 'not-allowed' : 'pointer', opacity: ordersPage <= 1 ? 0.5 : 1 }}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={ordersPage >= ordersTotalPages}
          onClick={() => fetchOrders(ordersPage + 1)}
          style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: ordersPage >= ordersTotalPages ? 'not-allowed' : 'pointer', opacity: ordersPage >= ordersTotalPages ? 0.5 : 1 }}
        >
          Next
        </button>
        <button onClick={() => fetchOrders(ordersPage)} style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {filteredOrders.map((order) => (
          <div key={order.id} style={{ background: 'white', borderRadius: 12, padding: 16, border: `2px solid ${selectedOrders.has(order.id) ? '#9c6649' : '#e5e7eb'}`, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={(e) => {
                e.stopPropagation();
                const newSet = new Set(selectedOrders);
                e.target.checked ? newSet.add(order.id) : newSet.delete(order.id);
                setSelectedOrders(newSet);
              }} />
              <div style={{ flex: 1 }} onClick={() => setSelectedOrder(order)}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>#{order.order_number}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{new Date(order.created_at).toLocaleDateString()}</div>
              </div>
              <div onClick={() => setSelectedOrder(order)}><Eye size={18} color="#6b7280" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${getStatusColor(order.status)}15`, color: getStatusColor(order.status) }}>
                {order.status}
              </span>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${getStatusColor(order.payment_status)}15`, color: getStatusColor(order.payment_status) }}>
                {order.payment_status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
              <div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>{order.customer_name}</div>
                {order.tracking_number && <div style={{ fontSize: 12, color: '#9c6649' }}><Truck size={12} style={{ display: 'inline', marginRight: 4 }} />{order.tracking_number}</div>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>${order.total.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMessages = () => (
    <div>
      {messagesError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#991b1b', fontSize: 14 }}>{messagesError}</span>
          <button type="button" onClick={fetchMessages} style={{ padding: '8px 14px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <select value={messageStatusFilter} onChange={(e) => setMessageStatusFilter(e.target.value)}
          style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}>
          <option value="all">All Messages</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="archived">Archived</option>
        </select>
        <button onClick={() => setSelectedMessages(new Set(filteredMessages.map(m => m.id)))} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Select All</button>
        <button onClick={() => setSelectedMessages(new Set())} style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Clear</button>
        {selectedMessages.size > 0 && (
          <>
            <button onClick={() => handleBulkMessageUpdate('read')} style={{ padding: '10px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Mark Read</button>
            <button onClick={() => handleBulkMessageUpdate('replied')} style={{ padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Mark Replied</button>
            <button onClick={() => handleBulkMessageUpdate('archived')} style={{ padding: '10px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Archive</button>
          </>
        )}
      </div>

      {/* Messages List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredMessages.map((msg) => (
          <div key={msg.id} style={{ background: 'white', borderRadius: 12, padding: 16, border: `2px solid ${selectedMessages.has(msg.id) ? '#9c6649' : '#e5e7eb'}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={selectedMessages.has(msg.id)} onChange={(e) => {
              const newSet = new Set(selectedMessages);
              e.target.checked ? newSet.add(msg.id) : newSet.delete(msg.id);
              setSelectedMessages(newSet);
            }} style={{ marginTop: 4 }} />
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => void openMessage(msg)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1f2937' }}>{msg.name}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{msg.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: `${getStatusColor(msg.status)}15`, color: getStatusColor(msg.status) }}>{msg.status}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(msg.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{msg.subject}</div>
              <div style={{ fontSize: 14, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div>
      {/* Search */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 400 }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search customers..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showDeletedCustomers}
            onChange={(e) => setShowDeletedCustomers(e.target.checked)}
          />
          Show deleted customers
        </label>
      </div>

      {/* Customers Table */}
      <div className="responsive-table-wrap" style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 480 : 640 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Customer</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Orders</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Total Spent</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Last Order</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.email} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, color: '#1f2937' }}>{customer.name || 'N/A'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{customer.email}</div>
                </td>
                <td style={{ padding: 16, fontWeight: 600 }}>{customer.total_orders}</td>
                <td style={{ padding: 16, fontWeight: 600, color: '#10b981' }}>${customer.total_spent.toFixed(2)}</td>
                <td style={{ padding: 16, color: '#6b7280' }}>{customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString() : 'N/A'}</td>
                <td style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={async () => { setSelectedCustomer(customer); await fetchCustomerHistory(customer.email); }}
                      style={{ padding: '8px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      View History
                    </button>
                    {customer.is_deleted ? (
                      <button type="button" onClick={() => handleRestoreCustomer(customer)}
                        style={{ padding: '8px 16px', background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        Restore
                      </button>
                    ) : (
                      <button type="button" onClick={() => setAdminDialog({ kind: 'deleteCustomer', customer })}
                        style={{ padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'customers', label: 'Customers', icon: Users },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div ref={adminHeaderRef} style={{ background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)', padding: isMobile ? '16px' : '24px 40px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 800, color: 'white' }}>Admin Dashboard</h1>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: adminHeaderHeight, zIndex: 99 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', background: 'none', border: 'none', borderBottom: activeTab === id ? '3px solid #9c6649' : '3px solid transparent',
                color: activeTab === id ? '#9c6649' : '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? 16 : 32 }}>
        {loading ? (
          <>
            <SkeletonStyles />
            <DashboardSkeleton isMobile={isMobile} />
          </>
        ) : (
          <>
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'coupons' && <AdminCouponsTab />}
            {activeTab === 'reviews' && <AdminReviewsTab />}
            {activeTab === 'messages' && renderMessages()}
            {activeTab === 'customers' && renderCustomers()}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <LiquidModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} maxWidth={700}>
          <div className="responsive-modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800 }}>#{selectedOrder.order_number}</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280', marginTop: 4 }}>{new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <span style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: `${getStatusColor(selectedOrder.status)}15`, color: getStatusColor(selectedOrder.status) }}>{selectedOrder.status}</span>
              <span style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: `${getStatusColor(selectedOrder.payment_status)}15`, color: getStatusColor(selectedOrder.payment_status) }}>{selectedOrder.payment_status}</span>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: 0, marginBottom: 16, fontWeight: 700 }}>Customer</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <div><span style={{ color: '#6b7280', fontSize: 12 }}>Name</span><p style={{ margin: 0, fontWeight: 600 }}>{selectedOrder.customer_name}</p></div>
                <div><span style={{ color: '#6b7280', fontSize: 12 }}>Email</span><p style={{ margin: 0, fontWeight: 600 }}>{selectedOrder.customer_email}</p></div>
              </div>
              {selectedOrder.shipping_address && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Shipping Address</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>{selectedOrder.shipping_address.address}, {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zipCode}, {selectedOrder.shipping_address.country}</p>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, marginBottom: 16, fontWeight: 700 }}>Items ({selectedOrder.items.length})</h3>
              {selectedOrder.items.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 8 }}>
                  <div><p style={{ margin: 0, fontWeight: 600 }}>{item.product_name}</p><p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Qty: {item.quantity} {item.size_value && `• Size: ${item.size_value}`}</p></div>
                  <div style={{ fontWeight: 700 }}>${(item.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#ecfdf5', borderRadius: 12, padding: 20, border: '1px solid #10b981', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal</span><span>${selectedOrder.subtotal.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Shipping</span><span>${selectedOrder.shipping_cost.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #d1fae5' }}><span>Tax</span><span>${selectedOrder.tax.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800 }}><span>Total</span><span style={{ color: '#10b981' }}>${selectedOrder.total.toFixed(2)}</span></div>
            </div>

            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontWeight: 700 }}>Fulfillment</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#374151' }}>
                  Tracking number
                  <input value={orderTrackingNumber} onChange={(e) => setOrderTrackingNumber(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                </label>
                <label style={{ fontSize: 13, color: '#374151' }}>
                  Carrier
                  <input value={orderCarrier} onChange={(e) => setOrderCarrier(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                </label>
              </div>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 12 }}>
                Tracking URL (optional)
                <input value={orderTrackingUrl} onChange={(e) => setOrderTrackingUrl(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </label>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 12 }}>
                Estimated delivery
                <input
                  type="date"
                  value={orderEstimatedDelivery}
                  onChange={(e) => setOrderEstimatedDelivery(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" disabled={orderActionLoading} onClick={() => handleSaveTracking(selectedOrder.id)}
                  style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Save tracking
                </button>
                <button type="button" disabled={orderActionLoading} onClick={() => handleNotifyShipped(selectedOrder.id)}
                  style={{ padding: '10px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Send size={16} /> Notify shipped
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedOrder.status === 'pending' && (
                <button type="button" disabled={orderActionLoading} onClick={() => handleOrderStatusUpdate(selectedOrder.id, 'processing')}
                  style={{ padding: '10px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Mark processing
                </button>
              )}
              {['pending', 'processing'].includes(selectedOrder.status) && (
                <button type="button" disabled={orderActionLoading} onClick={() => handleOrderStatusUpdate(selectedOrder.id, 'shipped')}
                  style={{ padding: '10px 16px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Mark shipped
                </button>
              )}
              {selectedOrder.status === 'shipped' && (
                <button type="button" disabled={orderActionLoading} onClick={() => handleOrderStatusUpdate(selectedOrder.id, 'delivered')}
                  style={{ padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={16} /> Mark delivered
                </button>
              )}
              {selectedOrder.payment_status === 'pending' && selectedOrder.status !== 'cancelled' && (
                <button type="button" disabled={orderActionLoading} onClick={() => setAdminDialog({ kind: 'markPaid', orderId: selectedOrder.id })}
                  style={{ padding: '10px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Mark paid
                </button>
              )}
              {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                <button type="button" disabled={orderActionLoading} onClick={() => setAdminDialog({ kind: 'cancelOrder', orderId: selectedOrder.id })}
                  style={{ padding: '10px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ban size={16} /> Cancel order
                </button>
              )}
            </div>
          </div>
        </LiquidModal>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <LiquidModal isOpen={!!selectedMessage} onClose={() => setSelectedMessage(null)} maxWidth={600}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{selectedMessage.subject}</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280', marginTop: 4 }}>From: {selectedMessage.name} ({selectedMessage.email})</p>
              </div>
              <button onClick={() => setSelectedMessage(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selectedMessage.message}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`} style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: '#9c6649', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
                <Mail size={18} /> Reply via Email
              </a>
              {selectedMessage.status !== 'replied' && (
                <button
                  type="button"
                  onClick={() => void updateMessageStatus(selectedMessage.id, 'replied')}
                  style={{ flex: 1, minWidth: 140, padding: 14, background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark replied
                </button>
              )}
              {selectedMessage.status !== 'archived' && (
                <button
                  type="button"
                  onClick={() => void updateMessageStatus(selectedMessage.id, 'archived')}
                  style={{ flex: 1, minWidth: 140, padding: 14, background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        </LiquidModal>
      )}

      <AdminProductFormModal
        isOpen={productFormOpen}
        product={editingProduct}
        onClose={() => {
          setProductFormOpen(false);
          setEditingProduct(null);
        }}
        onSaved={() => fetchProducts(1, false)}
      />

      {/* Customer History Modal */}
      {selectedCustomer && (
        <LiquidModal isOpen={!!selectedCustomer} onClose={() => { setSelectedCustomer(null); setCustomerOrders([]); }} maxWidth={800}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{selectedCustomer.name || 'Customer'}</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280', marginTop: 4 }}>{selectedCustomer.email}</p>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerOrders([]); }} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div className="admin-stats-row" style={{ marginBottom: 24 }}>
              <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#9c6649' }}>{selectedCustomer.total_orders}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Total Orders</p>
              </div>
              <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#10b981' }}>${selectedCustomer.total_spent.toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Total Spent</p>
              </div>
              <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1f2937' }}>{selectedCustomer.first_order_date ? new Date(selectedCustomer.first_order_date).toLocaleDateString() : 'N/A'}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>First Order</p>
              </div>
            </div>
            <h3 style={{ margin: 0, marginBottom: 16, fontWeight: 700 }}>Order History</h3>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {customerHistoryLoading ? (
                <p style={{ padding: 16, color: '#6b7280', textAlign: 'center' }}>Loading order history…</p>
              ) : customerOrders.length === 0 ? (
                <p style={{ padding: 16, color: '#6b7280', textAlign: 'center' }}>No orders found for this customer.</p>
              ) : customerOrders.map((order) => (
                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>#{order.order_number}</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: `${getStatusColor(order.status)}15`, color: getStatusColor(order.status) }}>{order.status}</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>${order.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LiquidModal>
      )}

      {adminDialog?.kind === 'markPaid' && (
        <AdminActionDialog
          open
          variant="prompt"
          title="Mark order as paid"
          message="Enter the PayPal capture ID and a reason. The capture is verified against PayPal before the order is completed."
          confirmLabel="Mark paid"
          inputLabel="PayPal capture ID"
          inputPlaceholder="e.g. 8AB12345CD678901E"
          secondInputLabel="Reason for manual payment"
          secondInputPlaceholder="e.g. PayPal dashboard capture confirmed"
          minLength={5}
          secondaryMinLength={3}
          onCancel={() => setAdminDialog(null)}
          onConfirm={({ primary, secondary }) => {
            const orderId = adminDialog.orderId;
            setAdminDialog(null);
            if (primary && secondary) {
              void executeMarkPaid(orderId, primary, secondary);
            }
          }}
        />
      )}
      {adminDialog?.kind === 'cancelOrder' && (
        <AdminActionDialog
          open
          variant="prompt"
          title="Cancel order"
          message="Optionally provide a cancellation reason. A refund will be processed when applicable."
          confirmLabel="Cancel order"
          inputLabel="Cancellation reason (optional)"
          inputPlaceholder="Optional"
          inputRequired={false}
          minLength={0}
          onCancel={() => setAdminDialog(null)}
          onConfirm={({ primary }) => {
            const orderId = adminDialog.orderId;
            setAdminDialog(null);
            void executeCancelOrder(orderId, primary || undefined);
          }}
        />
      )}
      {adminDialog?.kind === 'deleteCustomer' && (
        <AdminActionDialog
          open
          variant="confirm"
          title="Soft-delete customer"
          message={`Soft-delete customer ${adminDialog.customer.email}? Their order history is retained.`}
          confirmLabel="Delete"
          onCancel={() => setAdminDialog(null)}
          onConfirm={() => {
            const customer = adminDialog.customer;
            setAdminDialog(null);
            void executeDeleteCustomer(customer);
          }}
        />
      )}
      {adminDialog?.kind === 'deleteProduct' && (
        <AdminActionDialog
          open
          variant="confirm"
          title="Delete product"
          message={`Delete "${adminDialog.product.name}" (${adminDialog.product.size || 'no size'})? This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setAdminDialog(null)}
          onConfirm={() => {
            const product = adminDialog.product;
            setAdminDialog(null);
            void executeDeleteProduct(product);
          }}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
