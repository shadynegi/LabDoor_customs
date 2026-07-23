// AdminDashboard.tsx - Enhanced Admin panel with analytics, bulk actions, and product management
import React, { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  DollarSign,
  TrendingUp,
  Search,
  Truck,
  Eye,
  RefreshCw,
  LogOut,
  BarChart3,
  ShoppingBag,
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
  Download,
  History,
  CalendarDays,
  Settings,
} from 'lucide-react';
import { apiFetch, catalogFetch, slowApiFetch, config, getApiHeaders, ensureCsrfToken } from '../config';
import { useAdminAuth, ADMIN_LOGIN_PATH } from '../contexts/AdminAuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { toast } from 'sonner';
import LiquidModal from '../components/LiquidModal';
import AdminProductFormModal, { type AdminProduct } from '../components/AdminProductFormModal';
import {
  type AnalyticsPeriod,
  analyticsExportFilename,
  buildAnalyticsQueryParams,
  defaultCustomFromYmd,
  isCustomAnalyticsRangeApplied,
  todayIstYmd,
} from '../lib/adminAnalyticsDates';
import AdminCouponsTab from '../components/AdminCouponsTab';
import AdminActionDialog from '../components/AdminActionDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import ToggleSwitch from '../components/ToggleSwitch';
import { clearProductCatalogCache } from '../lib/productCatalogCache';
import { resolveProductImage } from '../lib/productImageMaps';
import { DashboardSkeleton, SkeletonStyles } from '../components/Skeletons';
import { logError } from '../lib/logger';

// Types
interface ShippingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [key: string]: string | undefined;
}

interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  size_system?: string;
  size_value?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  estimated_delivery?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

type Product = AdminProduct & {
  view_count?: number;
  cart_count?: number;
};

interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  admin_notes?: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  first_order_date: string;
  is_deleted?: boolean;
}

interface InventoryMovement {
  id: number;
  product_id: number;
  delta: number;
  quantity_after: number;
  reason: string;
  reference_type?: string;
  reference_id?: string;
  admin_username?: string;
  note?: string;
  created_at: string;
}

interface AdminSession {
  id: string;
  username: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  is_current?: boolean;
}

interface AnalyticsOrders {
  total_orders: number;
  total_revenue: number;
  orders_last_30_days: number;
  revenue_last_30_days: number;
}

interface AnalyticsProducts {
  total_products: number;
  out_of_stock_products: number;
  total_views: number;
  total_cart_adds: number;
}

interface AnalyticsCustomers {
  total_customers: number;
  new_customers_30_days: number;
}

interface Analytics {
  orders: AnalyticsOrders;
  products: AnalyticsProducts;
  topViewedProducts: Record<string, unknown>[];
  topCartedProducts: Record<string, unknown>[];
  customerLocations: Record<string, unknown>[];
  countrySummary: Record<string, unknown>[];
  recentOrders: Record<string, unknown>[];
  dailyTrend: Record<string, unknown>[];
  customers: AnalyticsCustomers;
  sales?: {
    range: { period: string; from: string; to: string; bucket: string };
    summary: {
      total_units_sold: number;
      total_revenue: number;
      order_count: number;
      average_order_value: number;
      estimated_gross_profit: number | null;
    };
    compare?: { revenue_change_pct: number | null };
    top_sellers_by_units: Array<{ product_id: number | null; product_name: string; units_sold: number }>;
    top_sellers_by_revenue: Array<{ product_id: number | null; product_name: string; revenue: number }>;
    best_period: { period_start: string; revenue: number; orders: number } | null;
  };
  inventory?: {
    low_stock_count: number;
    low_stock_products: Array<{ id: number; name: string; stock: number; low_stock_threshold: number }>;
  };
  integrations?: {
    ga4?: { configured: boolean; measurementId: string | null; consoleUrl: string };
    searchConsole?: { configured: boolean; siteUrl: string | null; consoleUrl: string };
  };
}

type Tab = 'analytics' | 'products' | 'orders' | 'customers' | 'coupons' | 'settings';

const CUSTOMER_HISTORY_PAGE_SIZE = 10;

type AdminDialog =
  | { kind: 'markPaid'; orderId: string }
  | { kind: 'cancelOrder'; orderId: string }
  | { kind: 'deleteCustomer'; customer: Customer }
  | { kind: 'deleteProduct'; product: Product }
  | null;

function StatCard({
  icon: Icon,
  title,
  value,
  color,
  subtitle,
  isMobile,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  color: string;
  subtitle?: string;
  isMobile: boolean;
}) {
  return (
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
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout: adminLogout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const { isMobile } = useResponsive();
  const adminHeaderRef = useRef<HTMLDivElement>(null);
  const analyticsAbortRef = useRef<AbortController | null>(null);
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('month');
  const [analyticsCustomFrom, setAnalyticsCustomFrom] = useState(defaultCustomFromYmd);
  const [analyticsCustomTo, setAnalyticsCustomTo] = useState(todayIstYmd);
  const [analyticsAppliedCustomFrom, setAnalyticsAppliedCustomFrom] = useState<string | null>(null);
  const [analyticsAppliedCustomTo, setAnalyticsAppliedCustomTo] = useState<string | null>(null);
  const [analyticsExporting, setAnalyticsExporting] = useState(false);
  const [activityExporting, setActivityExporting] = useState(false);
  const [activityExportStart, setActivityExportStart] = useState('');
  const [activityExportEnd, setActivityExportEnd] = useState('');
  const [adminSessions, setAdminSessions] = useState<AdminSession[]>([]);
  const [sessionStats, setSessionStats] = useState<{
    total_sessions: number;
    active_sessions: number;
    expired_sessions: number;
  } | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsCleaning, setSessionsCleaning] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotalPages, setProductsTotalPages] = useState(1);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [stockTogglingIds, setStockTogglingIds] = useState<Set<number>>(new Set());
  
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
  const [customerHistoryTotalPages, setCustomerHistoryTotalPages] = useState(1);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  
  // Filter states
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<typeof products | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersPage, setCustomersPage] = useState(1);
  const [customersTotalPages, setCustomersTotalPages] = useState(1);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState({ name: '', phone: '', admin_notes: '' });
  const [customerSaveLoading, setCustomerSaveLoading] = useState(false);

  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [bulkStockModalOpen, setBulkStockModalOpen] = useState(false);
  const [bulkStockMode, setBulkStockMode] = useState<'set' | 'delta'>('set');
  const [bulkStockValue, setBulkStockValue] = useState(0);
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [orderCustomerEdit, setOrderCustomerEdit] = useState(false);
  const [orderCustomerForm, setOrderCustomerForm] = useState({
    customer_name: '',
    customer_email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    admin_notes: '',
  });
  
  // Bulk selection states
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminDialog, setAdminDialog] = useState<AdminDialog>(null);
  const tabLoadedRef = useRef<Set<Tab>>(new Set());

  const invalidateTab = (tab: Tab) => {
    tabLoadedRef.current.delete(tab);
  };

  const loadTabData = async (tab: Tab, options?: { force?: boolean }) => {
    if (tab === 'coupons') {
      setLoading(false);
      return;
    }

    const force = options?.force ?? false;
    if (!force && tabLoadedRef.current.has(tab)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      switch (tab) {
        case 'analytics':
          await fetchAnalytics();
          break;
        case 'orders':
          await fetchOrders();
          break;
        case 'products':
          await fetchProducts(1, false);
          break;
        case 'customers':
          await fetchCustomers();
          break;
        case 'settings':
          await fetchAdminSessions();
          break;
      }
      tabLoadedRef.current.add(tab);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      analyticsAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    void loadTabData(activeTab);
  }, [activeTab]);

  const productSearchSeq = useRef(0);

  useEffect(() => {
    if (!productSearch.trim()) {
      setProductSearchResults(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      const seq = ++productSearchSeq.current;
      try {
        const response = await catalogFetch('/products/search', {
          method: 'POST',
          cache: 'no-store',
          body: JSON.stringify({
            query: productSearch.trim(),
            limit: 50,
            page: 1,
          }),
        });
        const data = await response.json();
        if (seq !== productSearchSeq.current) return;
        if (data.success) {
          setProductSearchResults(
            (data.data || []).map((p: { id: number; name: string; price: string | number; stock?: number; is_out_of_stock?: boolean }) => ({
              ...p,
              price: parseFloat(String(p.price)),
              is_out_of_stock: p.is_out_of_stock || false,
            }))
          );
        } else {
          setProductSearchResults([]);
          toast.error(data.error || 'Product search failed');
        }
      } catch (error) {
        if (seq !== productSearchSeq.current) return;
        logError('Admin product search failed:', error);
        toast.error('Product search failed');
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [productSearch]);

  const fetchAnalytics = async (
    period: AnalyticsPeriod = analyticsPeriod,
    customFrom: string = analyticsCustomFrom,
    customTo: string = analyticsCustomTo,
  ) => {
    if (period === 'custom' && customFrom > customTo) {
      toast.error('Start date must be on or before end date');
      return;
    }
    setAnalyticsError(null);
    analyticsAbortRef.current?.abort();
    const controller = new AbortController();
    analyticsAbortRef.current = controller;
    try {
      const query = buildAnalyticsQueryParams(period, customFrom, customTo);
      const response = await slowApiFetch(`/admin/analytics?${query}`, {
        signal: controller.signal,
        retry: { count: 1, on: [502, 503, 504] },
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (data.success) {
        setAnalytics(data.data);
        if (period === 'custom') {
          setAnalyticsAppliedCustomFrom(customFrom);
          setAnalyticsAppliedCustomTo(customTo);
        }
      } else {
        setAnalytics(null);
        setAnalyticsError(data.error || 'Failed to load analytics');
        toast.error(data.error || 'Failed to load analytics');
      }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return;
      }
      logError('Error fetching analytics:', error);
      setAnalytics(null);
      setAnalyticsError('Unable to load analytics. Check your connection and try again.');
      toast.error('Failed to load analytics');
    }
  };

  const handleAnalyticsExport = async () => {
    if (analyticsPeriod === 'custom') {
      if (!isCustomAnalyticsRangeApplied(
        analyticsCustomFrom,
        analyticsCustomTo,
        analyticsAppliedCustomFrom,
        analyticsAppliedCustomTo,
      )) {
        toast.error('Apply the date range before exporting');
        return;
      }
      if (analyticsCustomFrom > analyticsCustomTo) {
        toast.error('Start date must be on or before end date');
        return;
      }
    }
    setAnalyticsExporting(true);
    try {
      await ensureCsrfToken();
      const query =
        analyticsPeriod === 'custom'
          ? buildAnalyticsQueryParams('custom', analyticsAppliedCustomFrom!, analyticsAppliedCustomTo!)
          : buildAnalyticsQueryParams(analyticsPeriod, '', '');
      const response = await fetch(`${config.apiBaseUrl}/admin/analytics/export?${query}`, {
        credentials: 'include',
        headers: getApiHeaders(),
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        analyticsPeriod === 'custom'
          ? analyticsExportFilename('custom', analyticsAppliedCustomFrom!, analyticsAppliedCustomTo!)
          : analyticsExportFilename(analyticsPeriod, '', '');
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sales report downloaded');
    } catch (error) {
      logError('Analytics export error:', error);
      toast.error('Failed to export analytics');
    } finally {
      setAnalyticsExporting(false);
    }
  };

  const fetchAdminSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await apiFetch('/admin/sessions');
      const data = await response.json();
      if (data.success) {
        setAdminSessions(data.data.sessions || []);
        setSessionStats(data.data.stats || null);
      } else {
        toast.error(data.error || 'Failed to load admin sessions');
      }
    } catch (error) {
      logError('Error fetching admin sessions:', error);
      toast.error('Failed to load admin sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleActivityExport = async () => {
    if (activityExportStart && activityExportEnd && activityExportStart > activityExportEnd) {
      toast.error('Start date must be on or before end date');
      return;
    }
    setActivityExporting(true);
    try {
      await ensureCsrfToken();
      const params = new URLSearchParams();
      if (activityExportStart) params.set('startDate', `${activityExportStart}T00:00:00.000Z`);
      if (activityExportEnd) params.set('endDate', `${activityExportEnd}T23:59:59.999Z`);
      const query = params.toString();
      const response = await fetch(
        `${config.apiBaseUrl}/activity/export${query ? `?${query}` : ''}`,
        { credentials: 'include', headers: getApiHeaders() },
      );
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity-export.ndjson';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Activity log downloaded');
    } catch (error) {
      logError('Activity export error:', error);
      toast.error('Failed to export activity log');
    } finally {
      setActivityExporting(false);
    }
  };

  const handleSessionsCleanup = async () => {
    setSessionsCleaning(true);
    try {
      const response = await apiFetch('/admin/sessions/cleanup', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || 'Session cleanup complete');
        await fetchAdminSessions();
      } else {
        toast.error(data.error || 'Session cleanup failed');
      }
    } catch (error) {
      logError('Session cleanup error:', error);
      toast.error('Failed to clean up sessions');
    } finally {
      setSessionsCleaning(false);
    }
  };

  const handleRevokeSession = async (session: AdminSession) => {
    if (session.is_current) {
      toast.error('Use Logout to end your current session');
      return;
    }
    setRevokingSessionId(session.id);
    try {
      const response = await apiFetch(`/admin/sessions/${session.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to revoke session');
        return;
      }
      toast.success('Session revoked');
      await fetchAdminSessions();
    } catch (error) {
      logError('Session revoke error:', error);
      toast.error('Failed to revoke session');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleCustomerRecompute = async () => {
    setRecomputeLoading(true);
    try {
      const response = await apiFetch('/admin/customers/recompute', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || 'Customer aggregates recomputed');
        invalidateTab('customers');
        if (activeTab === 'customers') {
          void loadTabData('customers', { force: true });
        }
      } else {
        toast.error(data.error || 'Recompute failed');
      }
    } catch (error) {
      logError('Customer recompute error:', error);
      toast.error('Failed to recompute customer aggregates');
    } finally {
      setRecomputeLoading(false);
    }
  };

  const fetchOrders = async (
    page = ordersPage,
    search = orderSearch,
    statusFilter = orderStatusFilter
  ) => {
    setOrdersError(null);
    try {
      const statusQuery = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
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

  const removeProductFromLists = (productId: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setProductSearchResults((prev) => (prev ? prev.filter((p) => p.id !== productId) : prev));
    setLowStockProducts((prev) => prev.filter((p) => p.id !== productId));
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  };

  const fetchProducts = async (page = 1, append = false) => {
    if (append) {
      setProductsLoadingMore(true);
    } else {
      setProductsError(null);
    }
    try {
      const response = await catalogFetch(`/products?limit=50&page=${page}`, { cache: 'no-store' });
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

  const fetchCustomers = async (page = customersPage, search = customerSearch) => {
    try {
      const deletedQuery = showDeletedCustomers ? '&include_deleted=true' : '';
      const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const response = await apiFetch(`/admin/customers?limit=50&page=${page}${deletedQuery}${searchQuery}`);
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data || []);
        setCustomersTotal(data.pagination?.total ?? (data.data?.length ?? 0));
        setCustomersTotalPages(data.pagination?.totalPages ?? 1);
        setCustomersPage(data.pagination?.page ?? page);
      }
    } catch (error) {
      logError('Error fetching customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const fetchLowStockProducts = async () => {
    setLowStockLoading(true);
    try {
      const response = await apiFetch('/admin/products/low-stock?limit=200');
      const data = await response.json();
      if (data.success) {
        setLowStockProducts(
          (data.data || []).map((p: { id: number; name: string; stock: number; low_stock_threshold?: number }) => ({
            ...p,
            price: 0,
            image: '',
            is_out_of_stock: false,
          }))
        );
      } else {
        toast.error(data.error || 'Failed to load low stock products');
        setLowStockProducts([]);
      }
    } catch (error) {
      logError('Error fetching low stock:', error);
      toast.error('Failed to load low stock products');
      setLowStockProducts([]);
    } finally {
      setLowStockLoading(false);
    }
  };

  const openInventoryHistory = async (product: Product) => {
    setInventoryProduct(product);
    setInventoryMovements([]);
    setInventoryLoading(true);
    try {
      const response = await apiFetch(`/admin/products/${product.id}/inventory-movements`);
      const data = await response.json();
      if (data.success) {
        setInventoryMovements(data.data || []);
      } else {
        toast.error(data.error || 'Failed to load stock history');
      }
    } catch (error) {
      logError('Inventory movements error:', error);
      toast.error('Failed to load stock history');
    } finally {
      setInventoryLoading(false);
    }
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerEditForm({
      name: customer.name || '',
      phone: customer.phone || '',
      admin_notes: customer.admin_notes || '',
    });
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    setCustomerSaveLoading(true);
    try {
      const response = await apiFetch(`/admin/customers/${editingCustomer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: customerEditForm.name.trim(),
          phone: customerEditForm.phone.trim() || undefined,
          admin_notes: customerEditForm.admin_notes.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Customer updated');
        setEditingCustomer(null);
        fetchCustomers(customersPage, customerSearch);
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setCustomerSaveLoading(false);
    }
  };

  const handleSaveOrderCustomerDetails = async (orderId: string) => {
    setOrderActionLoading(true);
    try {
      const response = await apiFetch(`/orders/${orderId}/customer-details`, {
        method: 'PATCH',
        body: JSON.stringify({
          customer_name: orderCustomerForm.customer_name.trim(),
          customer_email: orderCustomerForm.customer_email.trim(),
          shipping_address: {
            address: orderCustomerForm.address.trim(),
            city: orderCustomerForm.city.trim(),
            state: orderCustomerForm.state.trim(),
            zipCode: orderCustomerForm.zipCode.trim(),
            country: orderCustomerForm.country.trim(),
          },
          admin_notes: orderCustomerForm.admin_notes.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Customer details updated');
        setOrderCustomerEdit(false);
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

  useEffect(() => {
    if (selectedOrder) {
      setOrderTrackingNumber(selectedOrder.tracking_number || '');
      setOrderTrackingUrl(selectedOrder.tracking_url || '');
      setOrderCarrier(selectedOrder.carrier || 'Blue Dart');
      setOrderEstimatedDelivery(
        selectedOrder.estimated_delivery ? selectedOrder.estimated_delivery.slice(0, 10) : ''
      );
      const addr = selectedOrder.shipping_address || {};
      setOrderCustomerForm({
        customer_name: selectedOrder.customer_name || '',
        customer_email: selectedOrder.customer_email || '',
        address: addr.address || '',
        city: addr.city || '',
        state: addr.state || '',
        zipCode: addr.zipCode || '',
        country: addr.country || '',
        admin_notes: selectedOrder.admin_notes || '',
      });
      setOrderCustomerEdit(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (activeTab === 'customers') {
      invalidateTab('customers');
      void loadTabData('customers', { force: true });
    }
  }, [showDeletedCustomers]);

  const skipAnalyticsPeriodDebounce = useRef(true);
  useEffect(() => {
    if (activeTab !== 'analytics') {
      skipAnalyticsPeriodDebounce.current = true;
      return;
    }
    if (skipAnalyticsPeriodDebounce.current) {
      skipAnalyticsPeriodDebounce.current = false;
      return;
    }
    if (analyticsPeriod === 'custom') return;
    void fetchAnalytics(analyticsPeriod);
  }, [analyticsPeriod, activeTab]);

  useEffect(() => {
    if (activeTab === 'products' && showLowStockOnly) {
      void fetchLowStockProducts();
    }
  }, [showLowStockOnly, activeTab]);

  const skipCustomerSearchDebounce = useRef(true);
  useEffect(() => {
    if (activeTab !== 'customers') {
      skipCustomerSearchDebounce.current = true;
      return;
    }
    if (skipCustomerSearchDebounce.current) {
      skipCustomerSearchDebounce.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCustomersPage(1);
      fetchCustomers(1, customerSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [customerSearch, activeTab]);

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
        toast.success('Shipping notification sent via WhatsApp');
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
        body: JSON.stringify({ reason }),
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

  const fetchCustomerHistory = async (email: string, page = 1) => {
    setCustomerHistoryLoading(true);
    try {
      const response = await apiFetch(
        `/admin/customers/${encodeURIComponent(email)}?limit=${CUSTOMER_HISTORY_PAGE_SIZE}&page=${page}`
      );
      const data = await response.json();
      if (data.success) {
        setCustomerOrders(data.data.orders || []);
        setCustomerHistoryPage(data.pagination?.page ?? page);
        setCustomerHistoryTotalPages(data.pagination?.totalPages ?? 1);
      } else {
        toast.error(data.error || 'Failed to load customer history');
        setCustomerOrders([]);
        setCustomerHistoryPage(1);
        setCustomerHistoryTotalPages(1);
      }
    } catch (error) {
      logError('Error fetching customer history:', error);
      toast.error('Failed to load customer history');
      setCustomerOrders([]);
      setCustomerHistoryPage(1);
      setCustomerHistoryTotalPages(1);
    } finally {
      setCustomerHistoryLoading(false);
    }
  };

  const openCustomerHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerHistoryPage(1);
    await fetchCustomerHistory(customer.email, 1);
  };

  const closeCustomerHistory = () => {
    setSelectedCustomer(null);
    setCustomerOrders([]);
    setCustomerHistoryPage(1);
    setCustomerHistoryTotalPages(1);
  };

  const handleLogout = async () => {
    analyticsAbortRef.current?.abort();
    await adminLogout();
    toast.success('Logged out successfully');
    navigate(ADMIN_LOGIN_PATH, { replace: true });
  };

  // Bulk actions
  const handleBulkProductUpdate = async (updates: { is_out_of_stock?: boolean; stock?: number; stock_delta?: number }) => {
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
        setBulkStockModalOpen(false);
        fetchProducts();
        if (showLowStockOnly) fetchLowStockProducts();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleBulkStockSubmit = () => {
    if (bulkStockMode === 'set' && bulkStockValue < 0) {
      toast.error('Stock cannot be negative');
      return;
    }
    const updates = bulkStockMode === 'set'
      ? { stock: bulkStockValue }
      : { stock_delta: bulkStockValue };
    void handleBulkProductUpdate(updates);
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

  const patchProductStockInLists = (productId: number, isOutOfStock: boolean) => {
    const patch = (product: Product) =>
      product.id === productId ? { ...product, is_out_of_stock: isOutOfStock } : product;
    setProducts((prev) => prev.map(patch));
    setLowStockProducts((prev) => prev.map(patch));
    setProductSearchResults((prev) => (prev ? prev.map(patch) : prev));
  };

  const toggleProductStock = async (productId: number, nextOutOfStock: boolean) => {
    if (stockTogglingIds.has(productId)) return;

    const previousOutOfStock = !nextOutOfStock;
    setStockTogglingIds((prev) => new Set(prev).add(productId));
    patchProductStockInLists(productId, nextOutOfStock);

    try {
      const response = await apiFetch(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_out_of_stock: nextOutOfStock }),
      });
      const data = await response.json();
      if (data.success) {
        clearProductCatalogCache();
        if (data.data?.is_out_of_stock !== undefined) {
          patchProductStockInLists(productId, Boolean(data.data.is_out_of_stock));
        }
        toast.success(`Product marked as ${nextOutOfStock ? 'out of stock' : 'in stock'}`);
      } else {
        patchProductStockInLists(productId, previousOutOfStock);
        toast.error(data.error || 'Update failed');
      }
    } catch {
      patchProductStockInLists(productId, previousOutOfStock);
      toast.error('Update failed');
    } finally {
      setStockTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Delete failed');
        return;
      }
      clearProductCatalogCache();
      removeProductFromLists(product.id);
      invalidateTab('products');
      await fetchProducts(productsPage, false);
      toast.success('Product deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  // Filter functions
  const filteredOrders = orders;

  const filteredProducts = showLowStockOnly
    ? lowStockProducts
    : (productSearchResults ?? products.filter((p) => {
        return !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase());
      }));

  const analyticsPeriods: { id: AnalyticsPeriod; label: string }[] = [
    { id: 'day', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom' },
  ];

  const analyticsToday = todayIstYmd();
  const customRangeApplied = isCustomAnalyticsRangeApplied(
    analyticsCustomFrom,
    analyticsCustomTo,
    analyticsAppliedCustomFrom,
    analyticsAppliedCustomTo,
  );
  const canExportAnalytics =
    analyticsPeriod !== 'custom' || customRangeApplied;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b', processing: '#9c6649', shipped: '#9c6649',
      delivered: '#10b981', cancelled: '#ef4444', completed: '#10b981',
      failed: '#ef4444', refunded: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  const renderAnalytics = () => {
    if (analyticsError) {
      return (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <AlertTriangle size={40} color="#dc2626" style={{ marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>Analytics unavailable</h3>
          <p style={{ margin: '0 0 20px', color: '#6b7280' }}>{analyticsError}</p>
          <button
            type="button"
            onClick={() => void loadTabData('analytics', { force: true })}
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
        {/* Period selector + export */}
        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 24, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Sales period:</span>
            {analyticsPeriods.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAnalyticsPeriod(id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${analyticsPeriod === id ? '#9c6649' : '#e5e7eb'}`,
                  background: analyticsPeriod === id ? '#fdf4ef' : 'white',
                  color: analyticsPeriod === id ? '#9c6649' : '#374151',
                  fontWeight: analyticsPeriod === id ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={analyticsExporting || !canExportAnalytics}
              title={
                analyticsPeriod === 'custom' && !customRangeApplied
                  ? 'Apply the date range before exporting'
                  : undefined
              }
              onClick={() => void handleAnalyticsExport()}
              style={{
                marginLeft: isMobile ? 0 : 'auto',
                padding: '10px 16px',
                background: canExportAnalytics ? '#9c6649' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: analyticsExporting || !canExportAnalytics ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: analyticsExporting ? 0.7 : 1,
              }}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
          {analyticsPeriod === 'custom' && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'flex-end',
                width: '100%',
                borderTop: '1px solid #e5e7eb',
                paddingTop: 12,
              }}
            >
              <CalendarDays size={18} color="#9c6649" aria-hidden style={{ marginBottom: 10 }} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                From
                <input
                  id="admin-analytics-from"
                  name="analyticsCustomFrom"
                  type="date"
                  value={analyticsCustomFrom}
                  max={analyticsCustomTo}
                  onChange={(e) => setAnalyticsCustomFrom(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 14,
                    color: '#374151',
                    minWidth: isMobile ? '100%' : 160,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                To
                <input
                  id="admin-analytics-to"
                  name="analyticsCustomTo"
                  type="date"
                  value={analyticsCustomTo}
                  min={analyticsCustomFrom}
                  max={analyticsToday}
                  onChange={(e) => setAnalyticsCustomTo(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 14,
                    color: '#374151',
                    minWidth: isMobile ? '100%' : 160,
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void fetchAnalytics('custom', analyticsCustomFrom, analyticsCustomTo)}
                style={{
                  padding: '10px 16px',
                  background: '#fdf4ef',
                  color: '#9c6649',
                  border: '1px solid #9c6649',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  minWidth: isMobile ? '100%' : undefined,
                }}
              >
                Apply range
              </button>
              {!customRangeApplied && (
                <p style={{ margin: 0, width: '100%', fontSize: 12, color: '#6b7280' }}>
                  Apply the date range to refresh the dashboard and enable CSV export. Dates use IST (Asia/Kolkata).
                </p>
              )}
            </div>
          )}
        </div>

        {/* Period sales summary */}
        {analytics.sales && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard
                icon={ShoppingBag}
                title="Units sold"
                value={analytics.sales.summary.total_units_sold}
                color="#9c6649"
                subtitle={analytics.sales.range.period}
                isMobile={isMobile}
              />
              <StatCard
                icon={DollarSign}
                title="Revenue"
                value={`$${analytics.sales.summary.total_revenue.toFixed(2)}`}
                color="#10b981"
                subtitle={
                  analytics.sales.compare?.revenue_change_pct != null
                    ? `${analytics.sales.compare.revenue_change_pct >= 0 ? '+' : ''}${analytics.sales.compare.revenue_change_pct}% vs prior period`
                    : undefined
                }
                isMobile={isMobile}
              />
              <StatCard
                icon={TrendingUp}
                title="Avg order value"
                value={`$${analytics.sales.summary.average_order_value.toFixed(2)}`}
                color="#f59e0b"
                subtitle={`${analytics.sales.summary.order_count} orders`}
                isMobile={isMobile}
              />
              {analytics.sales.best_period && (
                <StatCard
                  icon={BarChart3}
                  title="Best period"
                  value={`$${analytics.sales.best_period.revenue.toFixed(2)}`}
                  color="#8b5cf6"
                  subtitle={`${new Date(analytics.sales.best_period.period_start).toLocaleDateString()} · ${analytics.sales.best_period.orders} orders`}
                  isMobile={isMobile}
                />
              )}
            </div>

            {analytics.inventory && analytics.inventory.low_stock_count > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <AlertTriangle size={20} color="#d97706" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#92400e' }}>
                    {analytics.inventory.low_stock_count} product{analytics.inventory.low_stock_count !== 1 ? 's' : ''} at or below low-stock threshold (5 units)
                  </div>
                  <div style={{ fontSize: 13, color: '#b45309', marginTop: 4 }}>
                    {analytics.inventory.low_stock_products.slice(0, 3).map((p) => p.name).join(', ')}
                    {analytics.inventory.low_stock_products.length > 3 ? '…' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveTab('products'); setShowLowStockOnly(true); }}
                  style={{ padding: '8px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  View low stock
                </button>
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 32 }}>
              <h3 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Top sellers</h3>
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analytics.sales.top_sellers_by_units.slice(0, 10).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                      <span style={{ fontWeight: 500 }}>{p.product_name}</span>
                      <span style={{ color: '#6b7280', fontSize: 13 }}>{p.units_sold} sold</span>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 0', textAlign: 'left', fontSize: 13, color: '#6b7280' }}>Product</th>
                      <th style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>Units</th>
                      <th style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.sales.top_sellers_by_units.slice(0, 10).map((p, i) => {
                      const rev = analytics.sales!.top_sellers_by_revenue.find((r) => r.product_id === p.product_id && r.product_name === p.product_name);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 0', fontWeight: 500 }}>{p.product_name}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#374151' }}>{p.units_sold}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                            ${(rev?.revenue ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard icon={Package} title="Total Orders" value={analytics.orders.total_orders} color="#9c6649" subtitle="All time" isMobile={isMobile} />
          <StatCard icon={DollarSign} title="Total Revenue" value={`$${analytics.orders.total_revenue.toFixed(2)}`} color="#10b981" subtitle="All time" isMobile={isMobile} />
          <StatCard icon={TrendingUp} title="Orders (30d)" value={analytics.orders.orders_last_30_days} color="#9c6649" subtitle={`$${analytics.orders.revenue_last_30_days.toFixed(2)} revenue`} isMobile={isMobile} />
          <StatCard icon={Users} title="Customers" value={analytics.customers.total_customers} color="#9c6649" subtitle={`${analytics.customers.new_customers_30_days} new (30d)`} isMobile={isMobile} />
        </div>

        {/* Product Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard icon={ShoppingBag} title="Products" value={analytics.products.total_products} color="#f59e0b" isMobile={isMobile} />
          <StatCard icon={AlertTriangle} title="Out of Stock" value={analytics.products.out_of_stock_products} color="#ef4444" isMobile={isMobile} />
          <StatCard icon={Eye} title="Product Views" value={analytics.products.total_views} color="#06b6d4" isMobile={isMobile} />
          <StatCard icon={ShoppingBag} title="Cart Adds" value={analytics.products.total_cart_adds} color="#9c6649" isMobile={isMobile} />
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
          <button type="button" onClick={() => void loadTabData('products', { force: true })} style={{ padding: '8px 14px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          Showing {filteredProducts.length}{showLowStockOnly ? ' low-stock' : ` of ${productsTotal}`} products
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
          <input
            id="admin-products-low-stock-only"
            name="showLowStockOnly"
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <label htmlFor="admin-product-search" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
            Search products
          </label>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            id="admin-product-search"
            name="productSearch"
            type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
            aria-label="Search products"
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
            <button onClick={() => setBulkStockModalOpen(true)} style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Adjust stock ({selectedProducts.size})
            </button>
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
      {showLowStockOnly && lowStockLoading ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>Loading low stock products…</p>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredProducts.map((product) => (
            <div key={product.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <input
                  id={`admin-product-select-${product.id}`}
                  name="selectedProducts"
                  type="checkbox"
                  aria-label={`Select ${product.name}`}
                  checked={selectedProducts.has(product.id)}
                  onChange={(e) => {
                    const newSet = new Set(selectedProducts);
                    e.target.checked ? newSet.add(product.id) : newSet.delete(product.id);
                    setSelectedProducts(newSet);
                  }}
                  style={{ marginTop: 4, minWidth: 20, minHeight: 20 }}
                />
                {product.image && (
                  <img src={resolveProductImage(product.image)} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: '#f3f4f6' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1f2937' }}>{product.name}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    ${product.price.toFixed(2)} · Stock {product.stock}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <ToggleSwitch
                      checked={Boolean(product.is_out_of_stock)}
                      loading={stockTogglingIds.has(product.id)}
                      onChange={(checked) => void toggleProductStock(product.id, checked)}
                      ariaLabel={`${product.name}: out of stock ${product.is_out_of_stock ? 'on' : 'off'}`}
                      size="sm"
                    />
                    <button type="button" aria-label="Stock history" onClick={() => void openInventoryHistory(product)} style={{ padding: 8, minHeight: 44, minWidth: 44, background: '#eff6ff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                      <History size={16} color="#2563eb" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Edit product" onClick={() => openEditProduct(product)} style={{ padding: 8, minHeight: 44, minWidth: 44, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                      <Pencil size={16} color="#374151" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Delete product" onClick={() => setAdminDialog({ kind: 'deleteProduct', product })} style={{ padding: 8, minHeight: 44, minWidth: 44, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                      <Trash2 size={16} color="#dc2626" aria-hidden="true" />
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
                <input id="admin-products-select-all" name="selectAllProducts" type="checkbox" aria-label="Select all products" checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                  onChange={(e) => setSelectedProducts(e.target.checked ? new Set(filteredProducts.map(p => p.id)) : new Set())} />
              </th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Product</th>
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
                  <input
                    id={`admin-product-select-${product.id}`}
                    name="selectedProducts"
                    type="checkbox"
                    aria-label={`Select ${product.name}`}
                    checked={selectedProducts.has(product.id)}
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
                        src={resolveProductImage(product.image)}
                        alt=""
                        style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: '#f3f4f6' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: '#1f2937' }}>{product.name}</div>
                    </div>
                  </div>
                </td>
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
                  <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
                    <ToggleSwitch
                      checked={Boolean(product.is_out_of_stock)}
                      loading={stockTogglingIds.has(product.id)}
                      onChange={(checked) => void toggleProductStock(product.id, checked)}
                      ariaLabel={`${product.name}: out of stock ${product.is_out_of_stock ? 'on' : 'off'}`}
                    />
                  </div>
                </td>
                <td style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => void openInventoryHistory(product)}
                      title="Stock history"
                      aria-label="Stock history"
                      style={{ padding: 8, background: '#eff6ff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <History size={16} color="#2563eb" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditProduct(product)}
                      title="Edit"
                      aria-label="Edit product"
                      style={{ padding: 8, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <Pencil size={16} color="#374151" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminDialog({ kind: 'deleteProduct', product })}
                      title="Delete"
                      aria-label="Delete product"
                      style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <Trash2 size={16} color="#dc2626" aria-hidden="true" />
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
          <button type="button" onClick={() => void loadTabData('orders', { force: true })}
            style={{ padding: '8px 14px', background: 'white', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <label htmlFor="admin-order-search" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
            Search orders
          </label>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            id="admin-order-search"
            name="orderSearch"
            type="text"
            placeholder="Search orders..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            aria-label="Search orders"
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
          />
        </div>
        <select id="admin-order-status-filter" name="orderStatusFilter" aria-label="Filter orders by status" value={orderStatusFilter} onChange={(e) => { setOrderStatusFilter(e.target.value); setOrdersPage(1); fetchOrders(1, orderSearch, e.target.value); }}
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
          <select id="admin-order-bulk-status" name="bulkOrderStatus" aria-label="Bulk update order status" onChange={(e) => { if (e.target.value) handleBulkOrderUpdate({ status: e.target.value }); e.target.value = ''; }}
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
        <button type="button" onClick={() => void fetchOrders(ordersPage)} style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {filteredOrders.map((order) => (
          <div key={order.id} style={{ background: 'white', borderRadius: 12, padding: 16, border: `2px solid ${selectedOrders.has(order.id) ? '#9c6649' : '#e5e7eb'}`, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input id={`admin-order-select-${order.id}`} name="selectedOrders" type="checkbox" aria-label={`Select order ${order.order_number}`} checked={selectedOrders.has(order.id)} onChange={(e) => {
                e.stopPropagation();
                const newSet = new Set(selectedOrders);
                e.target.checked ? newSet.add(order.id) : newSet.delete(order.id);
                setSelectedOrders(newSet);
              }} />
              <div style={{ flex: 1 }} onClick={() => setSelectedOrder(order)}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>#{order.order_number}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{new Date(order.created_at).toLocaleDateString()}</div>
              </div>
              <button
                type="button"
                aria-label="View order details"
                onClick={() => setSelectedOrder(order)}
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Eye size={18} color="#6b7280" aria-hidden="true" />
              </button>
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

  const renderCustomers = () => (
    <div>
      {/* Search */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 400 }}>
          <label htmlFor="admin-customer-search" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
            Search customers
          </label>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input id="admin-customer-search" name="customerSearch" type="text" placeholder="Search customers..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
            aria-label="Search customers"
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
          <input
            id="admin-show-deleted-customers"
            name="showDeletedCustomers"
            type="checkbox"
            checked={showDeletedCustomers}
            onChange={(e) => setShowDeletedCustomers(e.target.checked)}
          />
          Show deleted customers
        </label>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {customersTotal} customers · page {customersPage} of {customersTotalPages}
        </span>
        <button
          type="button"
          disabled={customersPage <= 1}
          onClick={() => fetchCustomers(customersPage - 1)}
          style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: customersPage <= 1 ? 'not-allowed' : 'pointer', opacity: customersPage <= 1 ? 0.5 : 1 }}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={customersPage >= customersTotalPages}
          onClick={() => fetchCustomers(customersPage + 1)}
          style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: customersPage >= customersTotalPages ? 'not-allowed' : 'pointer', opacity: customersPage >= customersTotalPages ? 0.5 : 1 }}
        >
          Next
        </button>
      </div>

      {/* Customers — cards on mobile, table on desktop */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {customers.map((customer) => (
            <div key={customer.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
              <div style={{ fontWeight: 700, color: '#1f2937' }}>{customer.name || 'N/A'}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, wordBreak: 'break-all' }}>{customer.email}</div>
              {customer.phone && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{customer.phone}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 13 }}>
                <div><span style={{ color: '#6b7280' }}>Orders</span><br /><strong>{customer.total_orders}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Spent</span><br /><strong style={{ color: '#10b981' }}>${customer.total_spent.toFixed(2)}</strong></div>
                <div><span style={{ color: '#6b7280' }}>First order</span><br /><strong>{customer.first_order_date ? new Date(customer.first_order_date).toLocaleDateString() : 'N/A'}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Last order</span><br /><strong>{customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString() : 'N/A'}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => openEditCustomer(customer)}
                  style={{ padding: '10px 14px', minHeight: 44, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={14} /> Edit
                </button>
                <button type="button" onClick={() => void openCustomerHistory(customer)}
                  style={{ padding: '10px 14px', minHeight: 44, background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  View History
                </button>
                {customer.is_deleted ? (
                  <button type="button" onClick={() => handleRestoreCustomer(customer)}
                    style={{ padding: '10px 14px', minHeight: 44, background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Restore
                  </button>
                ) : (
                  <button type="button" onClick={() => setAdminDialog({ kind: 'deleteCustomer', customer })}
                    style={{ padding: '10px 14px', minHeight: 44, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="responsive-table-wrap" style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Customer</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Phone</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Orders</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Total Spent</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>First Order</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Last Order</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, color: '#1f2937' }}>{customer.name || 'N/A'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{customer.email}</div>
                </td>
                <td style={{ padding: 16, color: '#6b7280', fontSize: 13 }}>{customer.phone || '—'}</td>
                <td style={{ padding: 16, fontWeight: 600 }}>{customer.total_orders}</td>
                <td style={{ padding: 16, fontWeight: 600, color: '#10b981' }}>${customer.total_spent.toFixed(2)}</td>
                <td style={{ padding: 16, color: '#6b7280' }}>{customer.first_order_date ? new Date(customer.first_order_date).toLocaleDateString() : 'N/A'}</td>
                <td style={{ padding: 16, color: '#6b7280' }}>{customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString() : 'N/A'}</td>
                <td style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openEditCustomer(customer)}
                      style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Edit
                    </button>
                    <button onClick={() => void openCustomerHistory(customer)}
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
      )}
    </div>
  );

  const settingsCardStyle: CSSProperties = {
    background: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    border: '1px solid #e5e7eb',
  };

  const renderSettings = () => (
    <div>
      <div style={settingsCardStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>Activity log export</h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
          Download all storefront activity as NDJSON. Optional date filters limit the export range.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#374151' }}>
            From (optional)
            <input
              id="admin-activity-export-start"
              name="activityExportStart"
              type="date"
              value={activityExportStart}
              onChange={(e) => setActivityExportStart(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#374151' }}>
            To (optional)
            <input
              id="admin-activity-export-end"
              name="activityExportEnd"
              type="date"
              value={activityExportEnd}
              onChange={(e) => setActivityExportEnd(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleActivityExport()}
            disabled={activityExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#9c6649',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: activityExporting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: activityExporting ? 0.7 : 1,
            }}
          >
            <Download size={16} />
            {activityExporting ? 'Exporting…' : 'Export activity log'}
          </button>
        </div>
      </div>

      <div style={settingsCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>Admin sessions</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
              Recent admin login sessions (last 50). Clean up removes expired sessions and keeps only the 5 newest per user. Revoke individual sessions to sign out other devices.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void fetchAdminSessions()}
              disabled={sessionsLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleSessionsCleanup()}
              disabled={sessionsCleaning}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: 8, cursor: sessionsCleaning ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, opacity: sessionsCleaning ? 0.7 : 1 }}
            >
              <Trash2 size={16} /> {sessionsCleaning ? 'Cleaning…' : 'Clean up'}
            </button>
          </div>
        </div>
        {sessionStats && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16, fontSize: 14, color: '#374151' }}>
            <span><strong>{sessionStats.total_sessions}</strong> total</span>
            <span><strong>{sessionStats.active_sessions}</strong> active</span>
            <span><strong>{sessionStats.expired_sessions}</strong> expired</span>
          </div>
        )}
        {sessionsLoading ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Loading sessions…</p>
        ) : adminSessions.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>No admin sessions found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>IP</th>
                  <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Created</th>
                  <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Expires</th>
                  <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminSessions.map((session) => (
                  <tr key={session.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>{session.username}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{session.ip_address || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{new Date(session.created_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{new Date(session.expires_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: session.is_active ? '#d1fae5' : '#f3f4f6',
                        color: session.is_active ? '#065f46' : '#6b7280',
                      }}>
                        {session.is_current ? 'Current' : session.is_active ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {session.is_current ? (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>This device</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleRevokeSession(session)}
                          disabled={revokingSessionId === session.id}
                          style={{
                            padding: '6px 12px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: revokingSessionId === session.id ? 'not-allowed' : 'pointer',
                            opacity: revokingSessionId === session.id ? 0.7 : 1,
                          }}
                        >
                          {revokingSessionId === session.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={settingsCardStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1f2937' }}>Customer aggregates</h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
          Rebuild customer order counts and spend totals from completed orders. Use after bulk data fixes or imports.
        </p>
        <button
          type="button"
          onClick={() => void handleCustomerRecompute()}
          disabled={recomputeLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: '#361906',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: recomputeLoading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: recomputeLoading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={16} />
          {recomputeLoading ? 'Recomputing…' : 'Recompute customer aggregates'}
        </button>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#f9fafb' }}>
      {/* Header */}
      <div ref={adminHeaderRef} style={{
        background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
        padding: isMobile ? '16px' : '24px 40px',
        paddingTop: isMobile ? 'max(16px, env(safe-area-inset-top, 0px))' : 'max(24px, env(safe-area-inset-top, 0px))',
        paddingLeft: isMobile ? 'max(16px, env(safe-area-inset-left, 0px))' : 'max(40px, env(safe-area-inset-left, 0px))',
        paddingRight: isMobile ? 'max(16px, env(safe-area-inset-right, 0px))' : 'max(40px, env(safe-area-inset-right, 0px))',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 800, color: 'white' }}>Admin Dashboard</h1>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: adminHeaderHeight, zIndex: 99 }}>
        <div
          role="tablist"
          aria-label="Admin sections"
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px))',
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`admin-tab-${id}`}
              aria-selected={activeTab === id}
              aria-controls={`admin-tabpanel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === id ? '3px solid #9c6649' : '3px solid transparent',
                color: activeTab === id ? '#9c6649' : '#6b7280',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={18} aria-hidden="true" /> {label}
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
          <div
            role="tabpanel"
            id={`admin-tabpanel-${activeTab}`}
            aria-labelledby={`admin-tab-${activeTab}`}
          >
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'coupons' && (
              <ErrorBoundary>
                <AdminCouponsTab />
              </ErrorBoundary>
            )}
            {activeTab === 'customers' && renderCustomers()}
            {activeTab === 'settings' && renderSettings()}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <LiquidModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} maxWidth={700} ariaLabel="Order details">
          <div className="responsive-modal-body" data-testid="admin-order-detail">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800 }}>#{selectedOrder.order_number}</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280', marginTop: 4 }}>{new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelectedOrder(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={20} aria-hidden="true" /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <span style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: `${getStatusColor(selectedOrder.status)}15`, color: getStatusColor(selectedOrder.status) }}>{selectedOrder.status}</span>
              <span style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: `${getStatusColor(selectedOrder.payment_status)}15`, color: getStatusColor(selectedOrder.payment_status) }}>{selectedOrder.payment_status}</span>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontWeight: 700 }}>Customer</h3>
                {selectedOrder.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setOrderCustomerEdit((v) => !v)}
                    style={{ padding: '6px 12px', background: orderCustomerEdit ? '#e5e7eb' : '#9c6649', color: orderCustomerEdit ? '#374151' : 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Pencil size={14} /> {orderCustomerEdit ? 'Cancel edit' : 'Edit details'}
                  </button>
                )}
              </div>
              {orderCustomerEdit && selectedOrder.status !== 'cancelled' ? (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    Name
                    <input id="admin-order-customer-name" name="customer_name" value={orderCustomerForm.customer_name} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, customer_name: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    Email
                    <input id="admin-order-customer-email" name="customer_email" type="email" value={orderCustomerForm.customer_email} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, customer_email: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    Street address
                    <input id="admin-order-customer-address" name="address" value={orderCustomerForm.address} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, address: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    City
                    <input id="admin-order-customer-city" name="city" value={orderCustomerForm.city} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, city: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    State
                    <input id="admin-order-customer-state" name="state" value={orderCustomerForm.state} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, state: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    ZIP
                    <input id="admin-order-customer-zip" name="zipCode" value={orderCustomerForm.zipCode} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, zipCode: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151' }}>
                    Country
                    <input id="admin-order-customer-country" name="country" value={orderCustomerForm.country} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, country: e.target.value }))}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 13, color: '#374151', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    Admin notes
                    <textarea id="admin-order-customer-notes" name="admin_notes" value={orderCustomerForm.admin_notes} onChange={(e) => setOrderCustomerForm((f) => ({ ...f, admin_notes: e.target.value }))}
                      rows={2}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
                  </label>
                  <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                    <button type="button" disabled={orderActionLoading} onClick={() => void handleSaveOrderCustomerDetails(selectedOrder.id)}
                      style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                      Save customer details
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                  {selectedOrder.admin_notes && (
                    <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fcd34d' }}>
                      <span style={{ color: '#92400e', fontSize: 12, fontWeight: 600 }}>Admin notes</span>
                      <p style={{ margin: '6px 0 0', fontSize: 14, color: '#78350f', whiteSpace: 'pre-wrap' }}>{selectedOrder.admin_notes}</p>
                    </div>
                  )}
                </>
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
                  <input id="admin-order-tracking-number" name="tracking_number" value={orderTrackingNumber} onChange={(e) => setOrderTrackingNumber(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                </label>
                <label style={{ fontSize: 13, color: '#374151' }}>
                  Carrier
                  <input id="admin-order-carrier" name="carrier" value={orderCarrier} onChange={(e) => setOrderCarrier(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                </label>
              </div>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 12 }}>
                Tracking URL (optional)
                <input id="admin-order-tracking-url" name="tracking_url" value={orderTrackingUrl} onChange={(e) => setOrderTrackingUrl(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </label>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 12 }}>
                Estimated delivery
                <input
                  id="admin-order-estimated-delivery"
                  name="estimated_delivery"
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
              {selectedOrder.payment_status === 'pending' &&
                selectedOrder.status !== 'cancelled' && (
                <button type="button" disabled={orderActionLoading} onClick={() => setAdminDialog({ kind: 'cancelOrder', orderId: selectedOrder.id })}
                  style={{ padding: '10px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ban size={16} /> Cancel unpaid order
                </button>
              )}
            </div>
          </div>
        </LiquidModal>
      )}

      <ErrorBoundary>
        <AdminProductFormModal
          isOpen={productFormOpen}
          product={editingProduct}
          onClose={() => {
            setProductFormOpen(false);
            setEditingProduct(null);
          }}
          onSaved={() => fetchProducts(1, false)}
        />
      </ErrorBoundary>

      {/* Bulk stock modal */}
      {bulkStockModalOpen && (
        <LiquidModal isOpen onClose={() => setBulkStockModalOpen(false)} maxWidth={420} ariaLabel="Bulk stock update">
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Adjust stock</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              Update stock for {selectedProducts.size} selected product{selectedProducts.size !== 1 ? 's' : ''}.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button type="button" onClick={() => setBulkStockMode('set')}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bulkStockMode === 'set' ? '#9c6649' : '#e5e7eb'}`, background: bulkStockMode === 'set' ? '#fdf4ef' : 'white', fontWeight: 600, cursor: 'pointer' }}>
                Set to value
              </button>
              <button type="button" onClick={() => setBulkStockMode('delta')}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bulkStockMode === 'delta' ? '#9c6649' : '#e5e7eb'}`, background: bulkStockMode === 'delta' ? '#fdf4ef' : 'white', fontWeight: 600, cursor: 'pointer' }}>
                Add / subtract
              </button>
            </div>
            <label htmlFor="admin-bulk-stock-value" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {bulkStockMode === 'set' ? 'New stock level' : 'Stock change (+/-)'}
            </label>
            <input
              id="admin-bulk-stock-value"
              name="bulkStockValue"
              type="number"
              value={bulkStockValue}
              onChange={(e) => setBulkStockValue(parseInt(e.target.value, 10) || 0)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setBulkStockModalOpen(false)}
                style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button type="button" onClick={handleBulkStockSubmit}
                style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Apply
              </button>
            </div>
          </div>
        </LiquidModal>
      )}

      {/* Inventory history modal */}
      {inventoryProduct && (
        <LiquidModal isOpen onClose={() => { setInventoryProduct(null); setInventoryMovements([]); }} maxWidth={640} ariaLabel="Stock history">
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Stock history</h2>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>{inventoryProduct.name}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => { setInventoryProduct(null); setInventoryMovements([]); }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            {inventoryLoading ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>Loading movements…</p>
            ) : inventoryMovements.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>No inventory movements recorded.</p>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {inventoryMovements.map((m) => (
                  <div key={m.id} style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ color: m.delta >= 0 ? '#16a34a' : '#dc2626' }}>{m.delta >= 0 ? '+' : ''}{m.delta}</span>
                      <span style={{ color: '#6b7280', fontSize: 13 }}>→ {m.quantity_after}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{m.reason} · {new Date(m.created_at).toLocaleString()}</div>
                    {m.admin_username && <div style={{ fontSize: 12, color: '#9ca3af' }}>by {m.admin_username}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="responsive-table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 12, color: '#6b7280' }}>Date</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>Change</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>After</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 12, color: '#6b7280' }}>Reason</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 12, color: '#6b7280' }}>Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryMovements.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 8px', fontSize: 13 }}>{new Date(m.created_at).toLocaleString()}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: m.delta >= 0 ? '#16a34a' : '#dc2626' }}>{m.delta >= 0 ? '+' : ''}{m.delta}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>{m.quantity_after}</td>
                        <td style={{ padding: '10px 8px', fontSize: 13, color: '#6b7280' }}>{m.reason}</td>
                        <td style={{ padding: '10px 8px', fontSize: 13, color: '#9ca3af' }}>{m.admin_username || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </LiquidModal>
      )}

      {/* Edit customer modal */}
      {editingCustomer && (
        <LiquidModal isOpen onClose={() => setEditingCustomer(null)} maxWidth={480} ariaLabel="Edit customer">
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Edit customer</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>{editingCustomer.email}</p>
            <label htmlFor="admin-customer-edit-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Name</label>
            <input id="admin-customer-edit-name" name="name" value={customerEditForm.name} onChange={(e) => setCustomerEditForm((f) => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
            <label htmlFor="admin-customer-edit-phone" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone</label>
            <input id="admin-customer-edit-phone" name="phone" value={customerEditForm.phone} onChange={(e) => setCustomerEditForm((f) => ({ ...f, phone: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
            <label htmlFor="admin-customer-edit-notes" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Admin notes</label>
            <textarea id="admin-customer-edit-notes" name="admin_notes" value={customerEditForm.admin_notes} onChange={(e) => setCustomerEditForm((f) => ({ ...f, admin_notes: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingCustomer(null)}
                style={{ padding: '10px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button type="button" disabled={customerSaveLoading} onClick={() => void handleSaveCustomer()}
                style={{ padding: '10px 16px', background: '#9c6649', color: 'white', border: 'none', borderRadius: 8, cursor: customerSaveLoading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: customerSaveLoading ? 0.7 : 1 }}>
                Save
              </button>
            </div>
          </div>
        </LiquidModal>
      )}

      {/* Customer History Modal */}
      {selectedCustomer && (
        <LiquidModal isOpen={!!selectedCustomer} onClose={closeCustomerHistory} maxWidth={800} ariaLabel="Customer history">
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{selectedCustomer.name || 'Customer'}</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280', marginTop: 4 }}>{selectedCustomer.email}</p>
              </div>
              <button type="button" aria-label="Close" onClick={closeCustomerHistory} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={20} aria-hidden="true" /></button>
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
            {customerHistoryTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  Page {customerHistoryPage} of {customerHistoryTotalPages}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={customerHistoryPage <= 1 || customerHistoryLoading}
                    onClick={() => void fetchCustomerHistory(selectedCustomer.email, customerHistoryPage - 1)}
                    style={{ padding: '8px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: customerHistoryPage <= 1 ? 'not-allowed' : 'pointer', opacity: customerHistoryPage <= 1 ? 0.5 : 1, fontSize: 13, fontWeight: 600 }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={customerHistoryPage >= customerHistoryTotalPages || customerHistoryLoading}
                    onClick={() => void fetchCustomerHistory(selectedCustomer.email, customerHistoryPage + 1)}
                    style={{ padding: '8px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: customerHistoryPage >= customerHistoryTotalPages ? 'not-allowed' : 'pointer', opacity: customerHistoryPage >= customerHistoryTotalPages ? 0.5 : 1, fontSize: 13, fontWeight: 600 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
          message="Enter a payment reference (UPI ID, WhatsApp confirmation, etc.) and a reason. The order moves to processing after you confirm."
          confirmLabel="Mark paid"
          inputLabel="Payment reference"
          inputPlaceholder="e.g. UPI ref or WhatsApp note"
          secondInputLabel="Reason for manual payment"
          secondInputPlaceholder="e.g. Payment confirmed on WhatsApp"
          minLength={3}
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
          message="Cancels unpaid pending orders only. Paid orders cannot be refunded — use the replacement workflow for manufacturing defects."
          confirmLabel="Cancel unpaid order"
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
          message={`Delete "${adminDialog.product.name}"? This cannot be undone.`}
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
