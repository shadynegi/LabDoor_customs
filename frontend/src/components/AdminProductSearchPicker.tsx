import { useCallback, useEffect, useRef, useState } from 'react';
import { catalogFetch } from '../config';
import { logError } from '../lib/logger';

export interface ProductSearchOption {
  id: number;
  name: string;
}

interface AdminProductSearchPickerProps {
  mode: 'single' | 'multi';
  /** Single mode: product id string; multi mode: comma-separated ids */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

function parseIdList(raw: string): number[] {
  return raw
    .split(',')
    .map((part) => parseInt(part.trim(), 10))
    .filter((id) => !Number.isNaN(id) && id > 0);
}

export default function AdminProductSearchPicker({
  mode,
  value,
  onChange,
  disabled = false,
  placeholder,
  inputStyle,
}: AdminProductSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchProducts = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await catalogFetch('/products/search', {
        method: 'POST',
        body: JSON.stringify({ query: trimmed, limit: 20, page: 1 }),
      });
      const data = await response.json();
      if (data.success) {
        setResults(
          (data.data || []).map((p: ProductSearchOption) => ({
            id: p.id,
            name: p.name,
          }))
        );
      } else {
        setResults([]);
      }
    } catch (error) {
      logError('Admin product search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchProducts(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchProducts]);

  const addProductId = (id: number) => {
    if (mode === 'single') {
      onChange(String(id));
      setOpen(false);
      setQuery('');
      return;
    }

    const ids = parseIdList(value);
    if (!ids.includes(id)) {
      onChange([...ids, id].join(', '));
    }
    setQuery('');
  };

  const selectedIds = mode === 'multi' ? parseIdList(value) : value ? [parseInt(value, 10)].filter((n) => !Number.isNaN(n)) : [];

  return (
    <div style={{ position: 'relative' }}>
      {mode === 'multi' && selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedIds.map((id) => (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: '#f5e0d5',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              #{id}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(selectedIds.filter((item) => item !== id).join(', '))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  padding: 0,
                  lineHeight: 1,
                }}
                aria-label={`Remove product ${id}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <label
        htmlFor="admin-product-search"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {placeholder || 'Search products by name'}
      </label>

      <input
        id="admin-product-search"
        name="productSearch"
        type="text"
        value={mode === 'single' && value && !open ? `Product #${value}` : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (mode === 'single' && value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder={placeholder || 'Search products by name…'}
        aria-label={placeholder || 'Search products by name'}
        style={
          inputStyle ?? {
            padding: '10px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            width: '100%',
          }
        }
      />

      {open && !disabled && (query.trim().length >= 2 || loading) && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {loading && (
            <p style={{ margin: 0, padding: 12, fontSize: 13, color: '#6b7280' }}>Searching…</p>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <p style={{ margin: 0, padding: 12, fontSize: 13, color: '#6b7280' }}>No products found</p>
          )}
          {!loading &&
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addProductId(product.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <strong>#{product.id}</strong> — {product.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
