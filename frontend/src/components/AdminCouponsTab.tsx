import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Tag, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { apiFetch } from '../config';
import AdminProductSearchPicker from './AdminProductSearchPicker';
import { toast } from 'sonner';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';
import AdminActionDialog from './AdminActionDialog';

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order?: number;
  maximum_discount?: number;
  max_uses?: number;
  used_count?: number;
  is_active?: boolean;
  valid_until?: string;
  applies_to?: 'all' | 'product';
  applies_to_ids?: number[];
}

const PRESET_DISCOUNTS = [5, 10, 20, 25, 50] as const;
const PAGE_SIZE = 10;

export default function AdminCouponsTab() {
  const { isMobile } = useResponsive();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [customCode, setCustomCode] = useState('');
  const [customPercent, setCustomPercent] = useState(10);
  const [customAppliesTo, setCustomAppliesTo] = useState<'all' | 'product'>('all');
  const [customAppliesToIds, setCustomAppliesToIds] = useState('');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editMaxUses, setEditMaxUses] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editAppliesTo, setEditAppliesTo] = useState<'all' | 'product'>('all');
  const [editAppliesToIds, setEditAppliesToIds] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/coupons?limit=${PAGE_SIZE}&page=${page}`);
      const data = await response.json();
      if (data.success) {
        setCoupons(
          (data.data || []).map((c: Coupon) => ({
            ...c,
            discount_value: parseFloat(String(c.discount_value)),
          }))
        );
        setTotalPages(data.pagination?.totalPages ?? 1);
      } else {
        toast.error(data.error || 'Failed to load coupons');
      }
    } catch (error) {
      logError('Error fetching coupons:', error);
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const parseAppliesToIds = (): number[] | null => {
    if (customAppliesTo === 'all') return null;
    const ids = customAppliesToIds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    return ids.length > 0 ? ids : null;
  };

  const createCoupon = async (
    code: string,
    percent: number,
    appliesTo: 'all' | 'product' = customAppliesTo
  ) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      toast.error('Coupon code is required');
      return;
    }

    const appliesToIds =
      appliesTo === 'all'
        ? null
        : appliesTo === customAppliesTo
          ? parseAppliesToIds()
          : null;
    if (appliesTo !== 'all' && !appliesToIds) {
      toast.error('Select at least one product ID for product-scoped coupons');
      return;
    }

    try {
      const response = await apiFetch('/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: normalized,
          description: `${percent}% off your order`,
          discount_type: 'percentage',
          discount_value: percent,
          minimum_order: 0,
          is_active: true,
          applies_to: appliesTo,
          applies_to_ids: appliesToIds,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Coupon ${normalized} created`);
        setCustomCode('');
        fetchCoupons();
      } else {
        toast.error(data.error || 'Failed to create coupon');
      }
    } catch {
      toast.error('Failed to create coupon');
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const response = await apiFetch(`/coupons/${coupon.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Coupon ${coupon.code} ${coupon.is_active ? 'deactivated' : 'activated'}`);
        fetchCoupons();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    }
  };

  const openEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setEditDescription(coupon.description || '');
    setEditMaxUses(coupon.max_uses != null ? String(coupon.max_uses) : '');
    setEditValidUntil(coupon.valid_until ? coupon.valid_until.slice(0, 10) : '');
    setEditIsActive(coupon.is_active !== false);
    setEditAppliesTo(coupon.applies_to || 'all');
    setEditAppliesToIds((coupon.applies_to_ids || []).join(', '));
  };

  const saveCouponEdit = async () => {
    if (!editingCoupon) return;
    setSavingEdit(true);
    try {
      const maxUses = editMaxUses.trim() ? Number(editMaxUses) : null;
      if (editMaxUses.trim() && (Number.isNaN(maxUses) || maxUses! < 0)) {
        toast.error('Max uses must be a non-negative number');
        return;
      }
      let appliesToIds: number[] | null = null;
      if (editAppliesTo !== 'all') {
        appliesToIds = editAppliesToIds
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n > 0);
        if (!appliesToIds.length) {
          toast.error('Enter at least one product ID');
          return;
        }
      }
      const response = await apiFetch(`/coupons/${editingCoupon.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: editDescription.trim() || undefined,
          max_uses: maxUses,
          valid_until: editValidUntil.trim() || null,
          is_active: editIsActive,
          applies_to: editAppliesTo,
          applies_to_ids: appliesToIds,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Coupon ${editingCoupon.code} updated`);
        setEditingCoupon(null);
        fetchCoupons();
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const executeDeleteCoupon = async (coupon: Coupon) => {
    try {
      const response = await apiFetch(`/coupons/${coupon.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('Coupon deleted');
        fetchCoupons();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div>
      <div style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Quick presets</h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280' }}>
          Create percentage coupons — checkout billing applies them automatically via server-side pricing.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {PRESET_DISCOUNTS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => createCoupon(`SAVE${pct}`, pct, 'all')}
              style={{
                padding: '10px 18px',
                background: '#f5e0d5',
                color: '#361906',
                border: '1px solid #9c6649',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {pct}% — SAVE{pct}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Custom coupon</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            Code
            <input
              id="admin-coupon-custom-code"
              name="customCode"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="MYCODE"
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 0, width: '100%', maxWidth: 200 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            Discount %
            <select
              id="admin-coupon-custom-percent"
              name="customPercent"
              value={customPercent}
              onChange={(e) => setCustomPercent(Number(e.target.value))}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            >
              {PRESET_DISCOUNTS.map((p) => (
                <option key={p} value={p}>{p}%</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            Applies to
            <select
              id="admin-coupon-custom-applies-to"
              name="customAppliesTo"
              value={customAppliesTo}
              onChange={(e) => setCustomAppliesTo(e.target.value as typeof customAppliesTo)}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            >
              <option value="all">Entire order</option>
              <option value="product">Specific products</option>
            </select>
          </label>
          {customAppliesTo === 'product' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, flex: '1 1 100%', minWidth: 0, maxWidth: '100%' }}>
              Products
              <AdminProductSearchPicker
                mode="multi"
                value={customAppliesToIds}
                onChange={setCustomAppliesToIds}
                placeholder="Search to add products…"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => createCoupon(customCode, customPercent)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#9c6649',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Plus size={16} /> Create
          </button>
          <button
            type="button"
            onClick={fetchCoupons}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="responsive-table-wrap" style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: '#6b7280' }}>Loading coupons…</p>
        ) : coupons.length === 0 ? (
          <p style={{ padding: 24, color: '#6b7280' }}>No coupons yet. Use a preset above to get started.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 480 : 640 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: 16, textAlign: 'left', fontSize: 13 }}>Code</th>
                <th style={{ padding: 16, textAlign: 'left', fontSize: 13 }}>Scope</th>
                <th style={{ padding: 16, textAlign: 'left', fontSize: 13 }}>Discount</th>
                <th style={{ padding: 16, textAlign: 'left', fontSize: 13 }}>Uses</th>
                <th style={{ padding: 16, textAlign: 'left', fontSize: 13 }}>Status</th>
                <th style={{ padding: 16, textAlign: 'center', fontSize: 13 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 16, fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Tag size={16} color="#9c6649" />
                      {coupon.code}
                    </span>
                  </td>
                  <td style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>
                    {coupon.applies_to === 'product'
                      ? `Products (${(coupon.applies_to_ids || []).length})`
                      : 'All'}
                  </td>
                  <td style={{ padding: 16 }}>
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : `$${coupon.discount_value.toFixed(2)}`}
                  </td>
                  <td style={{ padding: 16, color: '#6b7280' }}>
                    {coupon.used_count ?? 0}
                    {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ''}
                  </td>
                  <td style={{ padding: 16 }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: coupon.is_active ? '#dcfce7' : '#fee2e2',
                        color: coupon.is_active ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEditCoupon(coupon)}
                        title="Edit"
                        style={{ padding: 8, background: '#e0e7ff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      >
                        <Pencil size={16} color="#4338ca" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(coupon)}
                        title={coupon.is_active ? 'Deactivate' : 'Activate'}
                        style={{ padding: 8, background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      >
                        {coupon.is_active ? <ToggleRight size={18} color="#16a34a" /> : <ToggleLeft size={18} color="#9ca3af" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCouponToDelete(coupon)}
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
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
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
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}

      {editingCoupon && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !savingEdit && setEditingCoupon(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              border: '1px solid #e5e7eb',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit {editingCoupon.code}</h3>
              <button
                type="button"
                onClick={() => setEditingCoupon(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
              Description
              <input
                id="admin-coupon-edit-description"
                name="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
              Max uses (blank = unlimited)
              <input
                id="admin-coupon-edit-max-uses"
                name="maxUses"
                type="number"
                onChange={(e) => setEditMaxUses(e.target.value)}
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
              Valid until
              <input
                id="admin-coupon-edit-valid-until"
                name="validUntil"
                type="date"
                onChange={(e) => setEditValidUntil(e.target.value)}
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
              Applies to
              <select
                id="admin-coupon-edit-applies-to"
                name="appliesTo"
                value={editAppliesTo}
                onChange={(e) => setEditAppliesTo(e.target.value as 'all' | 'product')}
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              >
                <option value="all">All products</option>
                <option value="product">Specific products</option>
              </select>
            </label>
            {editAppliesTo === 'product' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
                Products
                <AdminProductSearchPicker
                  mode="multi"
                  value={editAppliesToIds}
                  onChange={setEditAppliesToIds}
                  placeholder="Search to add products…"
                />
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 20 }}>
              <input
                id="admin-coupon-edit-active"
                name="isActive"
                type="checkbox"
                onChange={(e) => setEditIsActive(e.target.checked)}
              />
              Active
            </label>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingCoupon(null)}
                disabled={savingEdit}
                style={{ padding: '10px 18px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCouponEdit}
                disabled={savingEdit}
                style={{
                  padding: '10px 18px',
                  background: '#9c6649',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {couponToDelete && (
        <AdminActionDialog
          open
          variant="confirm"
          title="Delete coupon"
          message={`Delete coupon ${couponToDelete.code}?`}
          confirmLabel="Delete"
          onCancel={() => setCouponToDelete(null)}
          onConfirm={() => {
            const coupon = couponToDelete;
            setCouponToDelete(null);
            void executeDeleteCoupon(coupon);
          }}
        />
      )}
    </div>
  );
}
