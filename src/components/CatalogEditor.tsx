import { useMemo, useState } from 'react';
import Text from '@commercetools-uikit/text';
import SelectInput from '@commercetools-uikit/select-input';
import FlatButton from '@commercetools-uikit/flat-button';
import type { CatalogProduct, CategoryLite } from '../lib/types';

type Side = 'available' | 'range';
const ALL = '__all__';

function LocalBadge() {
  return (
    <span
      title="Local / exclusive to this store"
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.04em',
        color: '#7a4d00',
        background: '#fdefc9',
        border: '1px solid #f4d78a',
        borderRadius: 4,
        padding: '1px 5px',
        flexShrink: 0,
      }}
    >
      LOCAL
    </span>
  );
}

function ProductCard({
  product,
  side,
  isLocal,
  onMove,
}: {
  product: CatalogProduct;
  side: Side;
  isLocal: boolean;
  onMove: (id: string, to: Side) => void;
}) {
  const to: Side = side === 'available' ? 'range' : 'available';
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', product.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onMove(product.id, to)}
      title={side === 'available' ? 'Click or drag to add to range' : 'Click or drag to remove from range'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid #e3e7ee',
        background: '#fff',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: '#f2f4f8',
          flexShrink: 0,
          backgroundImage: product.image ? `url(${product.image})` : undefined,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text.Detail isBold>{product.name}</Text.Detail>
          {isLocal && <LocalBadge />}
        </div>
        <Text.Detail tone="secondary">{product.sku}</Text.Detail>
      </div>
      <span style={{ color: '#7a8699', fontWeight: 700, fontSize: 16 }}>
        {side === 'available' ? '+' : '×'}
      </span>
    </div>
  );
}

function Column({
  title,
  side,
  products,
  isLocal,
  onMove,
  onDropSide,
  headerRight,
}: {
  title: string;
  side: Side;
  products: CatalogProduct[];
  isLocal: (p: CatalogProduct) => boolean;
  onMove: (id: string, to: Side) => void;
  onDropSide: (id: string) => void;
  headerRight?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropSide(id);
      }}
      style={{
        flex: 1,
        minWidth: 0,
        border: '1px solid',
        borderColor: over ? '#7ea6ff' : '#e3e7ee',
        background: over ? '#f2f6ff' : '#fafbfc',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 460,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid #eef1f5',
        }}
      >
        <Text.Detail isBold>
          {title} ({products.length})
        </Text.Detail>
        {headerRight}
      </div>
      <div style={{ overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {products.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Text.Detail tone="secondary">Drop products here</Text.Detail>
          </div>
        ) : (
          products.map((p) => (
            <ProductCard key={p.id} product={p} side={side} isLocal={isLocal(p)} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}

export default function CatalogEditor({
  products,
  categories,
  inRange,
  onChange,
  localCategoryId,
}: {
  products: CatalogProduct[];
  categories: CategoryLite[];
  inRange: Set<string>;
  onChange: (next: Set<string>) => void;
  localCategoryId?: string;
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL);
  const [localOnly, setLocalOnly] = useState(false);

  const isLocal = (p: CatalogProduct) => !!localCategoryId && p.categoryIds.includes(localCategoryId);
  const localCount = products.filter(isLocal).length;

  // categories that actually appear on these products
  const usedCategories = useMemo(() => {
    const ids = new Set<string>();
    products.forEach((p) => p.categoryIds.forEach((c) => ids.add(c)));
    return categories.filter((c) => ids.has(c.id));
  }, [products, categories]);

  const move = (id: string, to: Side) => {
    const next = new Set(inRange);
    if (to === 'range') next.add(id);
    else next.delete(id);
    onChange(next);
  };

  const matches = (p: CatalogProduct) => {
    if (localOnly && !isLocal(p)) return false;
    if (category !== ALL && !p.categoryIds.includes(category)) return false;
    if (q) {
      const hay = `${p.name} ${p.sku ?? ''} ${p.key ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  };

  const availableAll = products.filter((p) => !inRange.has(p.id));
  const rangeAll = products.filter((p) => inRange.has(p.id));
  const available = availableAll.filter(matches);
  const range = rangeAll.filter(matches);

  const addAllFiltered = () => {
    const next = new Set(inRange);
    available.forEach((p) => next.add(p.id));
    onChange(next);
  };
  const removeAllFiltered = () => {
    const next = new Set(inRange);
    range.forEach((p) => next.delete(p.id));
    onChange(next);
  };

  if (products.length === 0) {
    return (
      <Text.Body tone="secondary">
        No products available for this pillar yet (the catalogue is populated by the pillar feed).
        The store can still be provisioned with an empty range.
      </Text.Body>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 180 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or SKU…"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #c9d0da',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ width: 220 }}>
          <SelectInput
            value={category}
            onChange={(e) => setCategory(e.target.value as string)}
            options={[
              { value: ALL, label: 'All categories' },
              ...usedCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        {localCount > 0 && (
          <button
            onClick={() => setLocalOnly((v) => !v)}
            style={{
              border: '1px solid',
              borderColor: localOnly ? '#f4d78a' : '#c9d0da',
              background: localOnly ? '#fdefc9' : '#fff',
              color: localOnly ? '#7a4d00' : '#475467',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ★ Local only ({localCount})
          </button>
        )}
        <Text.Detail tone="secondary">
          {rangeAll.length} of {products.length} in range
        </Text.Detail>
      </div>

      {/* dual pane */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <Column
          title="Available"
          side="available"
          products={available}
          isLocal={isLocal}
          onMove={move}
          onDropSide={(id) => move(id, 'available')}
          headerRight={
            available.length > 0 ? <FlatButton label="Add all →" onClick={addAllFiltered} /> : undefined
          }
        />
        <Column
          title="In range"
          side="range"
          products={range}
          isLocal={isLocal}
          onMove={move}
          onDropSide={(id) => move(id, 'range')}
          headerRight={
            range.length > 0 ? <FlatButton label="← Remove all" onClick={removeAllFiltered} /> : undefined
          }
        />
      </div>
      <Text.Detail tone="secondary">
        Drag cards between columns, or click a card to move it. Use search / category to bulk add or remove.
      </Text.Detail>
    </div>
  );
}
