import { useEffect, useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LiquidModal from './LiquidModal';
import { apiFetch } from '../config';
import { apiUpload } from '../lib/apiUpload';
import { logError } from '../lib/logger';
import { clearProductCatalogCache } from '../lib/productCatalogCache';
import { resolveProductBackground, resolveProductImage } from '../lib/productImageMaps';
import { useResponsive } from '../hooks/useResponsive';

export interface AdminProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  stock: number;
  is_out_of_stock: boolean;
  video_360?: string | null;
  cost_price?: number | null;
}

export interface ProductFormPayload {
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  stock: number;
  is_out_of_stock?: boolean;
  video_360?: string | null;
  cost_price?: number | null;
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

const emptyForm = (): ProductFormPayload => ({
  name: '',
  price: 0,
  image: '',
  description: '',
  background: '',
  stock: 0,
  is_out_of_stock: false,
  video_360: '',
  cost_price: null,
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
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);

  const clearBlobPreview = (url: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const resetPendingFiles = () => {
    clearBlobPreview(imagePreviewUrl);
    clearBlobPreview(backgroundPreviewUrl);
    setImageFile(null);
    setBackgroundFile(null);
    setVideoFile(null);
    setImagePreviewUrl(null);
    setBackgroundPreviewUrl(null);
  };

  useEffect(() => {
    return () => {
      clearBlobPreview(imagePreviewUrl);
      clearBlobPreview(backgroundPreviewUrl);
    };
  }, [imagePreviewUrl, backgroundPreviewUrl]);

  useEffect(() => {
    if (!isOpen) return;
    if (product) {
      setForm({
        name: product.name,
        price: product.price,
        image: product.image || '',
        description: product.description || '',
        background: product.background || '',
        stock: product.stock,
        is_out_of_stock: product.is_out_of_stock,
        video_360: product.video_360 || '',
        cost_price: product.cost_price ?? null,
      });
    } else {
      setForm(emptyForm());
    }
    resetPendingFiles();
  }, [isOpen, product]);

  const setField = <K extends keyof ProductFormPayload>(key: K, value: ProductFormPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickImageFile = (file: File, field: 'image' | 'background') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be under 20 MB. Paste a hosted URL instead.');
      return;
    }
    if (field === 'image') {
      clearBlobPreview(imagePreviewUrl);
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setField('image', '');
    } else {
      clearBlobPreview(backgroundPreviewUrl);
      setBackgroundFile(file);
      setBackgroundPreviewUrl(URL.createObjectURL(file));
      setField('background', '');
    }
  };

  const pickVideoFile = (file: File) => {
    if (!file.type.startsWith('video/') || file.type !== 'video/mp4') {
      toast.error('Please select an MP4 video file');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error('Video must be under 15 MB. Paste a hosted MP4 URL instead.');
      return;
    }
    setVideoFile(file);
    setField('video_360', '');
  };

  const uploadPendingMedia = async (): Promise<Partial<Record<'image' | 'background' | 'video_360', string>>> => {
    if (!imageFile && !backgroundFile && !videoFile) return {};

    const formData = new FormData();
    if (imageFile) formData.append('image', imageFile);
    if (backgroundFile) formData.append('background', backgroundFile);
    if (videoFile) formData.append('video_360', videoFile);

    const response = await apiUpload('/admin/uploads/product-media', formData);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'File upload failed');
    }
    return data.data ?? {};
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Product name is required';
    if (form.price <= 0) return 'Price must be greater than zero';
    if (!form.image.trim() && !imageFile) return 'Product image is required (URL or upload)';
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
      const uploaded = await uploadPendingMedia();
      const payload: ProductFormPayload = {
        ...form,
        name: form.name.trim(),
        image: (uploaded.image ?? form.image.trim()),
        background: (uploaded.background ?? form.background?.trim()) || undefined,
        description: form.description?.trim() || undefined,
        is_out_of_stock: form.stock === 0 ? true : form.is_out_of_stock,
        video_360: (uploaded.video_360 ?? form.video_360?.trim()) || undefined,
        cost_price: form.cost_price != null && form.cost_price > 0 ? form.cost_price : undefined,
      };

      if (isEditing && product) {
        await saveProduct(payload, product.id);
        toast.success('Product updated');
      } else {
        await saveProduct(payload);
        toast.success('Product created');
      }

      clearProductCatalogCache();
      onSaved();
      onClose();
    } catch (err) {
      logError('Product save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = (src: string, kind: 'image' | 'background' = 'image') => {
    if (!src) return '';
    if (src.startsWith('data:') || src.startsWith('http')) return src;
    return kind === 'background' ? resolveProductBackground(src) ?? src : resolveProductImage(src);
  };

  const imageDisplayValue = imageFile
    ? imageFile.name
    : form.image.startsWith('data:')
      ? '(legacy embedded image)'
      : form.image;

  const backgroundDisplayValue = backgroundFile
    ? backgroundFile.name
    : form.background?.startsWith('data:')
      ? '(legacy embedded image)'
      : (form.background || '');

  const videoDisplayValue = videoFile
    ? videoFile.name
    : form.video_360?.startsWith('data:')
      ? '(legacy embedded MP4)'
      : (form.video_360 || '');

  return (
    <LiquidModal isOpen={isOpen} onClose={onClose} maxWidth={720}>
      <form data-testid="admin-product-form" onSubmit={handleSubmit} style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              {isEditing ? 'Edit Product' : 'Add New Shoe'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
              {isEditing
                ? 'Update listing details, images, and inventory.'
                : 'Create one catalog listing. All standard sizes are available on the storefront.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="admin-product-name" style={labelStyle}>Name *</label>
            <input
              id="admin-product-name"
              name="name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Nike Drops - Blue"
              style={inputStyle}
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="admin-product-price" style={labelStyle}>Price (USD) *</label>
            <input
              id="admin-product-price"
              name="price"
              type="number"
              min={0.01}
              step={0.01}
              value={form.price || ''}
              onChange={(e) => setField('price', parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="admin-product-stock" style={labelStyle}>Stock *</label>
            <input
              id="admin-product-stock"
              name="stock"
              type="number"
              min={0}
              step={1}
              value={form.stock}
              onChange={(e) => setField('stock', parseInt(e.target.value, 10) || 0)}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="admin-product-cost-price" style={labelStyle}>Cost price (USD)</label>
            <input
              id="admin-product-cost-price"
              name="cost_price"
              type="number"
              min={0}
              step={0.01}
              value={form.cost_price ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setField('cost_price', v === '' ? null : parseFloat(v) || 0);
              }}
              placeholder="Optional — for profit estimates"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="admin-product-description" style={labelStyle}>Description</label>
            <textarea
              id="admin-product-description"
              name="description"
              value={form.description || ''}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="Custom design details, materials, etc."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label htmlFor="admin-product-image" style={labelStyle}>Product image *</label>
            <input
              id="admin-product-image"
              name="image"
              type="text"
              value={imageDisplayValue}
              onChange={(e) => setField('image', e.target.value)}
              placeholder="/assets/blue-nike.png or https://..."
              style={{ ...inputStyle, marginBottom: 8 }}
              disabled={Boolean(imageFile || form.image.startsWith('data:'))}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9c6649', cursor: 'pointer', fontWeight: 600 }}>
              <Upload size={14} />
              Upload image (max 20 MB)
              <input
                id="admin-product-image-file"
                name="imageFile"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickImageFile(file, 'image');
                  e.target.value = '';
                }}
              />
            </label>
            {(imagePreviewUrl || form.image) && (
              <img
                src={imagePreviewUrl || previewSrc(form.image)}
                alt="Preview"
                style={{ marginTop: 10, width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 8, background: '#f3f4f6' }}
              />
            )}
          </div>

          <div>
            <label htmlFor="admin-product-background" style={labelStyle}>Background image</label>
            <input
              id="admin-product-background"
              name="background"
              type="text"
              value={backgroundDisplayValue}
              onChange={(e) => setField('background', e.target.value)}
              placeholder="/assets/blue-bg.png or https://..."
              style={{ ...inputStyle, marginBottom: 8 }}
              disabled={Boolean(backgroundFile || form.background?.startsWith('data:'))}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9c6649', cursor: 'pointer', fontWeight: 600 }}>
              <Upload size={14} />
              Upload background (max 20 MB)
              <input
                id="admin-product-background-file"
                name="backgroundFile"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickImageFile(file, 'background');
                  e.target.value = '';
                }}
              />
            </label>
            {(backgroundPreviewUrl || form.background) && (
              <img
                src={backgroundPreviewUrl || previewSrc(form.background || '', 'background')}
                alt="Background preview"
                style={{ marginTop: 10, width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 8, background: '#f3f4f6' }}
              />
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="admin-product-video" style={labelStyle}>360° spin video (MP4)</label>
            <input
              id="admin-product-video"
              name="video_360"
              type="text"
              value={videoDisplayValue}
              onChange={(e) => setField('video_360', e.target.value)}
              placeholder="https://…/spin.mp4 or upload below"
              style={{ ...inputStyle, marginBottom: 8 }}
              disabled={Boolean(videoFile || form.video_360?.startsWith('data:'))}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9c6649', cursor: 'pointer', fontWeight: 600 }}>
                <Upload size={14} />
                Upload MP4 (max 15 MB)
                <input
                  id="admin-product-video-file"
                  name="videoFile"
                  type="file"
                  accept="video/mp4,.mp4"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) pickVideoFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {(form.video_360 || videoFile) && (
                <button
                  type="button"
                  onClick={() => {
                    setVideoFile(null);
                    setField('video_360', '');
                  }}
                  style={{ fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remove video
                </button>
              )}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
              Optional. Shown in the product 360° viewer when customers tap Spin/360°.
            </p>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                id="admin-product-out-of-stock"
                name="is_out_of_stock"
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
            data-testid="admin-product-submit"
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
