import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Pencil, Plus, RefreshCw, Star, Trash2, X, XCircle } from 'lucide-react';
import { apiFetch } from '../config';
import { toast } from 'sonner';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';
import LiquidModal from './LiquidModal';
import AdminActionDialog from './AdminActionDialog';

interface Review {
  id: string;
  product_id: number;
  product_name?: string;
  customer_name: string;
  customer_email: string;
  rating: number;
  title?: string;
  content?: string;
  status: string;
  is_verified_purchase?: boolean;
  created_at: string;
}

interface ProductOption {
  id: number;
  name: string;
}

const emptyForm = () => ({
  product_id: '',
  customer_name: '',
  customer_email: '',
  rating: 5,
  title: '',
  content: '',
  status: 'approved' as const,
  is_verified_purchase: false,
});

export default function AdminReviewsTab() {
  const { isMobile } = useResponsive();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 50;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await apiFetch(`/reviews?${params}`);
      const data = await response.json();
      if (data.success) {
        setReviews(data.data || []);
        setTotalPages(data.pagination?.totalPages ?? 1);
      } else {
        toast.error(data.error || 'Failed to load reviews');
      }
    } catch (error) {
      logError('Fetch reviews error:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  const setStatusQuick = async (review: Review, status: string) => {
    try {
      const response = await apiFetch(`/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Review ${status}`);
        fetchReviews();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    }
  };

  const fetchProducts = useCallback(async () => {
    try {
      const response = await apiFetch('/products?limit=100');
      const data = await response.json();
      if (data.success) {
        setProducts(
          (data.data || []).map((p: { id: number; name: string }) => ({
            id: p.id,
            name: p.name,
          }))
        );
      }
    } catch (error) {
      logError('Fetch products for reviews:', error);
    }
  }, []);

  useEffect(() => {
    void fetchReviews();
    void fetchProducts();
  }, [fetchReviews, fetchProducts]);

  const openCreate = () => {
    setEditingReview(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (review: Review) => {
    setEditingReview(review);
    setForm({
      product_id: String(review.product_id),
      customer_name: review.customer_name,
      customer_email: review.customer_email,
      rating: review.rating,
      title: review.title || '',
      content: review.content || '',
      status: (review.status as 'approved') || 'approved',
      is_verified_purchase: Boolean(review.is_verified_purchase),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingReview(null);
    setForm(emptyForm());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.product_id) {
      toast.error('Product and customer name are required');
      return;
    }

    setSaving(true);
    try {
      if (editingReview) {
        const response = await apiFetch(`/reviews/${editingReview.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            product_id: parseInt(form.product_id, 10),
            customer_name: form.customer_name.trim(),
            customer_email: form.customer_email.trim() || undefined,
            rating: form.rating,
            title: form.title.trim() || null,
            content: form.content.trim() || null,
            status: form.status,
            is_verified_purchase: form.is_verified_purchase,
          }),
        });
        const data = await response.json();
        if (data.success) {
          toast.success('Review updated');
          closeModal();
          fetchReviews();
        } else {
          toast.error(data.error || 'Update failed');
        }
      } else {
        const response = await apiFetch('/reviews/admin', {
          method: 'POST',
          body: JSON.stringify({
            product_id: parseInt(form.product_id, 10),
            customer_name: form.customer_name.trim(),
            customer_email: form.customer_email.trim() || undefined,
            rating: form.rating,
            title: form.title.trim() || undefined,
            content: form.content.trim() || undefined,
            status: form.status,
            is_verified_purchase: form.is_verified_purchase,
          }),
        });
        const data = await response.json();
        if (data.success) {
          toast.success('Review created');
          closeModal();
          fetchReviews();
        } else {
          toast.error(data.error || 'Create failed');
        }
      }
    } catch (error) {
      logError('Save review error:', error);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async (review: Review) => {
    try {
      const response = await apiFetch(`/reviews/${review.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('Review deleted');
        fetchReviews();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'rejected':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800 }}>Reviews</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 14,
            }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
          </select>
          <button
            type="button"
            onClick={() => fetchReviews()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: '#9c6649',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Plus size={16} /> Create Review
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No reviews found.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{review.customer_name}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                    {review.customer_email}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: `${statusColor(review.status)}15`,
                    color: statusColor(review.status),
                    textTransform: 'capitalize',
                  }}
                >
                  {review.status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    fill={i < review.rating ? '#f59e0b' : 'none'}
                    color={i < review.rating ? '#f59e0b' : '#d1d5db'}
                  />
                ))}
                <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 4 }}>
                  {review.product_name || `Product #${review.product_id}`}
                </span>
              </div>

              {review.title && (
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{review.title}</div>
              )}
              {review.content && (
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
                  {review.content.length > 160
                    ? `${review.content.slice(0, 160)}…`
                    : review.content}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 16,
                  flexWrap: 'wrap',
                }}
              >
                {review.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStatusQuick(review, 'approved')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 14px',
                        background: '#dcfce7',
                        color: '#16a34a',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusQuick(review, 'rejected')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 14px',
                        background: '#fef3c7',
                        color: '#b45309',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(review)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '8px 14px',
                    background: '#ede9fe',
                    color: '#7c3aed',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setReviewToDelete(review)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '8px 14px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white' }}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontSize: 14, color: '#6b7280' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white' }}
          >
            Next
          </button>
        </div>
      )}

      <LiquidModal isOpen={modalOpen} onClose={closeModal} maxWidth={560}>
        <div className="responsive-modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              {editingReview ? 'Edit Review' : 'Create Review'}
            </h3>
            <button
              type="button"
              onClick={closeModal}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Product
              <select
                required
                value={form.product_id}
                onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
                disabled={Boolean(editingReview)}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Customer name *
              <input
                required
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Customer email
              <input
                type="email"
                value={form.customer_email}
                onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                placeholder="optional"
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Rating
              <select
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: parseInt(e.target.value, 10) }))}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Review
              <textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as typeof f.status,
                  }))
                }
                style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="flagged">Flagged</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.is_verified_purchase}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_verified_purchase: e.target.checked }))
                }
              />
              Verified purchase badge
            </label>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: 14,
                background: '#9c6649',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : editingReview ? 'Save Changes' : 'Create Review'}
            </button>
          </form>
        </div>
      </LiquidModal>

      {reviewToDelete && (
        <AdminActionDialog
          open
          variant="confirm"
          title="Delete review"
          message={`Delete review by ${reviewToDelete.customer_name}?`}
          confirmLabel="Delete"
          onCancel={() => setReviewToDelete(null)}
          onConfirm={() => {
            const review = reviewToDelete;
            setReviewToDelete(null);
            void executeDelete(review);
          }}
        />
      )}
    </div>
  );
}
