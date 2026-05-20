// AdminDashboard.tsx - Enhanced Admin panel with analytics, bulk actions, and product management
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
  ExternalLink,
  User,
  Mail,
  Phone,
  MapPin,
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
  Check,
  X,
  Archive,
  Trash2,
  Edit2,
  MapPinned,
} from 'lucide-react';
import { apiFetch } from '../config';
import { toast } from 'sonner';
import LiquidModal from '../components/LiquidModal';
import LiquidButton from '../components/LiquidButton';
import { DashboardSkeleton } from '../components/Skeletons';

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

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  category?: string;
  stock: number;
  rating?: number;
  review_count?: number;
  view_count?: number;
  cart_count?: number;
  is_out_of_stock: boolean;
}

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
  email: string;
  name: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  first_order_date: string;
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
}

type Tab = 'analytics' | 'products' | 'orders' | 'messages' | 'customers';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  
  // Filter states
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [messageStatusFilter, setMessageStatusFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Bulk selection states
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
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
          await fetchProducts();
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
    try {
      const response = await apiFetch('/admin/analytics', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await apiFetch('/orders', {
        headers: getAuthHeaders(),
      });
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
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiFetch('/products?limit=100');
      const data = await response.json();
      if (data.success) {
        const parsed = (data.data || []).map((p: any) => ({
          ...p,
          price: parseFloat(p.price),
          is_out_of_stock: p.is_out_of_stock || false,
        }));
        setProducts(parsed);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await apiFetch('/contact', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await apiFetch('/admin/customers', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchCustomerHistory = async (email: string) => {
    try {
      const response = await apiFetch(`/admin/customers/${encodeURIComponent(email)}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setCustomerOrders(data.data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching customer history:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminTokenExpires');
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
        headers: getAuthHeaders(),
        body: JSON.stringify({ productIds: Array.from(selectedProducts), updates }),
      });
      const data = await response.json();
      if (data.success) {
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
        headers: getAuthHeaders(),
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

  const handleBulkMessageUpdate = async (status: string) => {
    if (selectedMessages.size === 0) {
      toast.error('No messages selected');
      return;
    }
    try {
      const response = await apiFetch('/admin/messages/bulk-update', {
        method: 'POST',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_out_of_stock: !currentStatus }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Product marked as ${!currentStatus ? 'out of stock' : 'in stock'}`);
        fetchProducts();
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  // Filter functions
  const filteredOrders = orders.filter(o => {
    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    const matchesSearch = !orderSearch || 
      o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customer_email.toLowerCase().includes(orderSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredProducts = products.filter(p => {
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
      pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
      delivered: '#10b981', cancelled: '#ef4444', completed: '#10b981',
      failed: '#ef4444', refunded: '#6b7280', new: '#3b82f6',
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
    if (!analytics) return <div style={{ textAlign: 'center', padding: 60 }}>Loading analytics...</div>;

    return (
      <div>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard icon={Package} title="Total Orders" value={analytics.orders.total_orders} color="#667eea" subtitle="All time" />
          <StatCard icon={DollarSign} title="Total Revenue" value={`$${analytics.orders.total_revenue.toFixed(2)}`} color="#10b981" subtitle="All time" />
          <StatCard icon={TrendingUp} title="Orders (30d)" value={analytics.orders.orders_last_30_days} color="#3b82f6" subtitle={`$${analytics.orders.revenue_last_30_days.toFixed(2)} revenue`} />
          <StatCard icon={Users} title="Customers" value={analytics.customers.total_customers} color="#8b5cf6" subtitle={`${analytics.customers.new_customers_30_days} new (30d)`} />
        </div>

        {/* Product Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard icon={ShoppingBag} title="Products" value={analytics.products.total_products} color="#f59e0b" />
          <StatCard icon={AlertTriangle} title="Out of Stock" value={analytics.products.out_of_stock_products} color="#ef4444" />
          <StatCard icon={Eye} title="Product Views" value={analytics.products.total_views} color="#06b6d4" />
          <StatCard icon={ShoppingBag} title="Cart Adds" value={analytics.products.total_cart_adds} color="#ec4899" />
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
                  <MapPinned size={16} color="#667eea" />
                  <span style={{ fontWeight: 600 }}>{loc.country || 'Unknown'}</span>
                </div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {loc.order_count} orders • ${parseFloat(loc.total_revenue).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProducts = () => (
    <div>
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
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
      </div>

      {/* Products Table */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', width: 40 }}>
                <input type="checkbox" checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                  onChange={(e) => setSelectedProducts(e.target.checked ? new Set(filteredProducts.map(p => p.id)) : new Set())} />
              </th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Product</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Price</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Stock</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Views</th>
              <th style={{ padding: 16, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }}>Cart Adds</th>
              <th style={{ padding: 16, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151' }}>Out of Stock</th>
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
                  <div style={{ fontWeight: 600, color: '#1f2937' }}>{product.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{product.category}</div>
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
                <td style={{ padding: 16, color: '#6b7280' }}>{product.cart_count || 0}</td>
                <td style={{ padding: 16, textAlign: 'center' }}>
                  <button onClick={() => toggleProductStock(product.id, product.is_out_of_stock)}
                    style={{ width: 40, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: product.is_out_of_stock ? '#ef4444' : '#10b981', position: 'relative' }}>
                    <span style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: 'white', top: 3,
                      left: product.is_out_of_stock ? 19 : 3, transition: 'left 0.2s' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div>
      {/* Toolbar */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search orders..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
        </div>
        <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}
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
            style={{ padding: '10px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600 }}>
            <option value="">Bulk Update ({selectedOrders.size})</option>
            <option value="processing">Mark Processing</option>
            <option value="shipped">Mark Shipped</option>
            <option value="delivered">Mark Delivered</option>
            <option value="cancelled">Mark Cancelled</option>
          </select>
        )}
        <button onClick={fetchOrders} style={{ padding: '10px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Orders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {filteredOrders.map((order) => (
          <div key={order.id} style={{ background: 'white', borderRadius: 12, padding: 16, border: `2px solid ${selectedOrders.has(order.id) ? '#667eea' : '#e5e7eb'}`, cursor: 'pointer' }}>
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
                {order.tracking_number && <div style={{ fontSize: 12, color: '#8b5cf6' }}><Truck size={12} style={{ display: 'inline', marginRight: 4 }} />{order.tracking_number}</div>}
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
          <div key={msg.id} style={{ background: 'white', borderRadius: 12, padding: 16, border: `2px solid ${selectedMessages.has(msg.id) ? '#667eea' : '#e5e7eb'}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={selectedMessages.has(msg.id)} onChange={(e) => {
              const newSet = new Set(selectedMessages);
              e.target.checked ? newSet.add(msg.id) : newSet.delete(msg.id);
              setSelectedMessages(newSet);
            }} style={{ marginTop: 4 }} />
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedMessage(msg)}>
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
      <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search customers..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
        </div>
      </div>

      {/* Customers Table */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <button onClick={async () => { setSelectedCustomer(customer); await fetchCustomerHistory(customer.email); }}
                    style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    View History
                  </button>
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
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'customers', label: 'Customers', icon: Users },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: isMobile ? '16px' : '24px 40px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 800, color: 'white' }}>Admin Dashboard</h1>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: isMobile ? 60 : 80, zIndex: 99 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', background: 'none', border: 'none', borderBottom: activeTab === id ? '3px solid #667eea' : '3px solid transparent',
                color: activeTab === id ? '#667eea' : '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? 16 : 32 }}>
        {loading ? (
          <div style={{ 
            background: 'white', 
            borderRadius: 16, 
            padding: 24, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            {/* Stats Skeleton */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', 
              gap: 16, 
              marginBottom: 24 
            }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  background: '#f9fafb',
                  borderRadius: 12,
                  padding: 20,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: 10,
                    marginBottom: 12,
                  }} />
                  <div style={{
                    width: '60%',
                    height: 14,
                    background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: 4,
                    marginBottom: 8,
                  }} />
                  <div style={{
                    width: '40%',
                    height: 28,
                    background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: 4,
                  }} />
                </div>
              ))}
            </div>
            
            {/* Table Skeleton */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr 1fr',
                  gap: 16,
                  padding: '16px 0',
                  borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none',
                }}>
                  {[1, 2, 3, 4, 5].slice(0, isMobile ? 2 : 5).map((j) => (
                    <div key={j} style={{
                      height: 20,
                      background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      borderRadius: 4,
                    }} />
                  ))}
                </div>
              ))}
            </div>
            <style>{`
              @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
          </div>
        ) : (
          <>
            {activeTab === 'analytics' && renderAnalytics()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'messages' && renderMessages()}
            {activeTab === 'customers' && renderCustomers()}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <LiquidModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} maxWidth={700}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>#{selectedOrder.order_number}</h2>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
            <div style={{ background: '#ecfdf5', borderRadius: 12, padding: 20, border: '1px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal</span><span>${selectedOrder.subtotal.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Shipping</span><span>${selectedOrder.shipping_cost.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #d1fae5' }}><span>Tax</span><span>${selectedOrder.tax.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800 }}><span>Total</span><span style={{ color: '#10b981' }}>${selectedOrder.total.toFixed(2)}</span></div>
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
            <div style={{ display: 'flex', gap: 12 }}>
              <a href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: '#667eea', color: 'white', textDecoration: 'none', borderRadius: 8, fontWeight: 600 }}>
                <Mail size={18} /> Reply via Email
              </a>
            </div>
          </div>
        </LiquidModal>
      )}

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#667eea' }}>{selectedCustomer.total_orders}</p>
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
              {customerOrders.map((order) => (
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
