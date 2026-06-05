import { useEffect, useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LiquidModal from './LiquidModal';
import { apiFetch } from '../config';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';

export interface AdminProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  category?: string;
  size?: string;
  color?: string;
  stock: number;
  is_out_of_stock: boolean;
}

export interface ProductFormPayload {
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  category?: string;
  size?: string;
  color?: string;
  stock: number;
  is_out_of_stock?: boolean;
}

const CATEGORIES = ['Sneakers', 'Boots', 'Sandals', 'Loafers', 'Custom'];
const COLORS = ['Black', 'White', 'Blue', 'Gold', 'Pink', 'Brown', 'Red', 'Green', 'Grey', 'Multi'];
const US_SIZES = [
  'US 6', 'US 6.5', 'US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9', 'US 9.5',
  'US 10', 'US 10.5', 'US 11', 'US 11.5', 'US 12', 'US 12.5', 'US 13',
];

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const emptyForm = (): ProductFormPayload => ({
  name: '',
  price: 0,
  image: '',
  description: '',
  background: '',
  category: 'Sneakers',
  size: 'US 10',
  color: 'Black',
  stock: 0,
  is_out_of_stock: false,
});

interface AdminProductFormModalProps {
  isOpen: boolean;
  product: AdminProduct | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

export default function AdminProductFormModal({
  isOpen,
  product,
  onClose,
  onSaved,
}: AdminProductFormModalProps) {
  const { isMobile } = useResponsive();
  const isEditing = Boolean(product);
  const [form, setForm] = useState<ProductFormPayload>(emptyForm());
  const [extraSizes, setExtraSizes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (product) {
      setForm({
        name: product.name,
        price: product.price,
        image: product.image || '',
        description: product.description || '',
        background: product.background || '',
        category: product.category || 'Sneakers',
        size: product.size || 'US 10',
        color: product.color || '',
        stock: product.stock,
        is_out_of_stock: product.is_out_of_stock,
      });
      setExtraSizes(new Set());
    } else {
      setForm(emptyForm());
      setExtraSizes(new Set());
    }
  }, [isOpen, product]);

  const setField = <K extends keyof ProductFormPayload>(key: K, value: ProductFormPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const readImageFile = (file: File, field: 'image' | 'background') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be under 2 MB. Paste a hosted URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField(field, reader.result as string);
    reader.onerror = () => toast.error('Failed to read image file');
    reader.readAsDataURL(file);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Product name is required';
    if (form.price <= 0) return 'Price must be greater than zero';
    if (!form.image.trim()) return 'Product image is required (URL or upload)';
    if (form.stock < 0) return 'Stock cannot be negative';
    return null;
  };

  const saveProduct = async (payload: ProductFormPayload, id?: number) => {
    const response = await apiFetch(id ? `/products/${id}` : '/products', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || data.error || 'Save failed');
    }
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const payload: ProductFormPayload = {
        ...form,
        name: form.name.trim(),
        image: form.image.trim(),
        background: form.background?.trim() || undefined,
        description: form.description?.trim() || undefined,
        category: form.category?.trim() || undefined,
        size: form.size?.trim() || undefined,
        color: form.color?.trim() || undefined,
        is_out_of_stock: form.stock === 0 ? true : form.is_out_of_stock,
      };

      if (isEditing && product) {
        await saveProduct(payload, product.id);
        toast.success('Product updated');
      } else {
        const sizes = [payload.size || 'US 10', ...Array.from(extraSizes)]
          .filter((s, i, arr) => arr.indexOf(s) === i);

        for (const size of sizes) {
          await saveProduct({ ...payload, size });
        }
        toast.success(
          sizes.length === 1
            ? 'Product created'
            : `Created ${sizes.length} size listings`
        );
      }

      onSaved();
      onClose();
    } catch (err) {
      logError('Product save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = (src: string) => {
    if (!src) return '';
    if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) return src;
    return src;
  };

  return (
    <LiquidModal isOpen={isOpen} onClose={onClose} maxWidth={720}>
      <form onSubmit={handleSubmit} style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              {isEditing ? 'Edit Product' : 'Add New Shoe'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
              {isEditing
                ? 'Update listing details, images, and inventory.'
                : 'Create a catalog listing with image, size, price, and stock.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Nike Drops - Blue"
              style={inputStyle}
              maxLength={100}
            />
          </div>

          <div>
            <label style={labelStyle}>Price (USD) *</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={form.price || ''}
              onChange={(e) => setField('price', parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Stock *</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.stock}
              onChange={(e) => setField('stock', parseInt(e.target.value, 10) || 0)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={form.category || ''}
              onChange={(e) => setField('category', e.target.value)}
              style={inputStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Primary size</label>
            <select
              value={form.size || ''}
              onChange={(e) => setField('size', e.target.value)}
              style={inputStyle}
            >
              {US_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Color</label>
            <select
              value={form.color || ''}
              onChange={(e) => setField('color', e.target.value)}
              style={inputStyle}
            >
              {COLORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="Custom design details, materials, etc."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Product image *</label>
            <input
              type="text"
              value={form.image.startsWith('data:') ? '(uploaded image)' : form.image}
              onChange={(e) => setField('image', e.target.value)}
              placeholder="/assets/blue-nike.png or https://..."
              style={{ ...inputStyle, marginBottom: 8 }}
              disabled={form.image.startsWith('data:')}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9c6649', cursor: 'pointer', fontWeight: 600 }}>
              <Upload size={14} />
              Upload image (max 2 MB)
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readImageFile(file, 'image');
                  e.target.value = '';
                }}
              />
            </label>
            {form.image && (
              <img
                src={previewSrc(form.image)}
                alt="Preview"
                style={{ marginTop: 10, width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 8, background: '#f3f4f6' }}
              />
            )}
          </div>

          <div>
            <label style={labelStyle}>Background image</label>
            <input
              type="text"
              value={form.background?.startsWith('data:') ? '(uploaded image)' : (form.background || '')}
              onChange={(e) => setField('background', e.target.value)}
              placeholder="/assets/blue-bg.png or https://..."
              style={{ ...inputStyle, marginBottom: 8 }}
              disabled={Boolean(form.background?.startsWith('data:'))}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9c6649', cursor: 'pointer', fontWeight: 600 }}>
              <Upload size={14} />
              Upload background
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readImageFile(file, 'background');
                  e.target.value = '';
                }}
              />
            </label>
            {form.background && (
              <img
                src={previewSrc(form.background)}
                alt="Background preview"
                style={{ marginTop: 10, width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
          </div>

          {!isEditing && (
            <div style={{ gridColumn: '1 / -1', background: '#f9fafb', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
              <label style={{ ...labelStyle, marginBottom: 10 }}>Also create listings for these sizes</label>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
                Each size becomes a separate product row with the same name, price, and images.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {US_SIZES.filter((s) => s !== form.size).map((size) => (
                  <label
                    key={size}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: `1px solid ${extraSizes.has(size) ? '#9c6649' : '#e5e7eb'}`,
                      background: extraSizes.has(size) ? '#fdf4ef' : 'white',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={extraSizes.has(size)}
                      onChange={(e) => {
                        const next = new Set(extraSizes);
                        if (e.target.checked) next.add(size);
                        else next.delete(size);
                        setExtraSizes(next);
                      }}
                    />
                    {size}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_out_of_stock}
                onChange={(e) => setField('is_out_of_stock', e.target.checked)}
              />
              Mark as out of stock (hidden from purchase even if stock &gt; 0)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '12px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: '#9c6649',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isEditing ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </LiquidModal>
  );
}
