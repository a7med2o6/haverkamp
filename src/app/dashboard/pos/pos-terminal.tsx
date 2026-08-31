'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  Loader2,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { PAYMENT_METHOD, toOptions } from '@/lib/labels';
import { cn, formatKWD } from '@/lib/utils';
import { createPosOrder, discardParkedOrder } from './actions';

export interface PosProduct {
  id: string;
  sku: string;
  barcode: string | null;
  nameAr: string;
  price: number;
  unit: string;
  type: 'GOOD' | 'SERVICE';
  trackStock: boolean;
  stockQty: number;
  categoryId: string | null;
}

interface CartLine {
  productId: string;
  label: string;
  unitPrice: number;
  qty: number;
  discount: number;
  unit: string;
  trackStock: boolean;
  stockQty: number;
}

function fils(n: number) {
  return Math.round(n * 1000) / 1000;
}

export interface ParkedOrder {
  id: string;
  number: string;
  createdAt: string;
  customerName: string | null;
  total: number;
  items: Array<{ productId: string | null; label: string; qty: number; unitPrice: number; discount: number }>;
}

export function PosTerminal({
  products,
  categories,
  customers,
  parkedOrders,
  hasOpenRegister,
}: {
  products: PosProduct[];
  categories: Array<{ id: string; nameAr: string }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  parkedOrders: ParkedOrder[];
  hasOpenRegister: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false); // درج السلة على الجوال
  const [parkedOpen, setParkedOpen] = useState(false);
  /** آخر فاتورة مُصدرة — تبقى معروضة حتى يبدأ الكاشير بيعاً جديداً */
  const [lastSale, setLastSale] = useState<{ id: string; number: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [recalling, startRecall] = useTransition();

  /** قارئ الباركود يكتب الرمز ثم Enter — نضيف الصنف فوراً ونفرّغ الحقل */
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const q = query.trim().toLowerCase();
    if (!q) return;

    const exact = products.find(
      (p) => p.barcode?.toLowerCase() === q || p.sku.toLowerCase() === q
    );
    const match = exact ?? (filtered.length === 1 ? filtered[0] : null);

    if (!match) {
      toast.error(
        filtered.length === 0 ? 'لا يوجد صنف بهذا الرمز' : 'أكثر من صنف مطابق — اختر يدوياً'
      );
      return;
    }

    addToCart(match);
    setQuery('');
    searchRef.current?.focus();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory === 'services' && p.type !== 'SERVICE') return false;
      if (
        activeCategory !== 'all' &&
        activeCategory !== 'services' &&
        p.categoryId !== activeCategory
      )
        return false;
      if (!q) return true;
      return (
        p.nameAr.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, query, activeCategory]);

  const subtotal = fils(cart.reduce((s, l) => s + l.qty * l.unitPrice - l.discount, 0));
  const total = fils(Math.max(0, subtotal - orderDiscount));

  function addToCart(p: PosProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        if (p.trackStock && existing.qty + 1 > p.stockQty) {
          toast.error(`الرصيد المتاح ${p.stockQty} ${p.unit} فقط`);
          return prev;
        }
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (p.trackStock && p.stockQty < 1) {
        toast.error(`"${p.nameAr}" غير متوفر في المخزون`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: p.id,
          label: p.nameAr,
          unitPrice: p.price,
          qty: 1,
          discount: 0,
          unit: p.unit,
          trackStock: p.trackStock,
          stockQty: p.stockQty,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l];
        const next = l.qty + delta;
        if (next <= 0) return [];
        if (l.trackStock && next > l.stockQty) {
          toast.error(`الرصيد المتاح ${l.stockQty} ${l.unit} فقط`);
          return [l];
        }
        return [{ ...l, qty: next }];
      })
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  /** يحمّل بنود فاتورة معلّقة في السلة ثم يحذف المسودة */
  function recallParked(order: ParkedOrder) {
    const lines: CartLine[] = [];
    const missing: string[] = [];

    for (const item of order.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        missing.push(item.label);
        continue;
      }
      lines.push({
        productId: product.id,
        label: item.label,
        unitPrice: item.unitPrice,
        qty: item.qty,
        discount: item.discount,
        unit: product.unit,
        trackStock: product.trackStock,
        stockQty: product.stockQty,
      });
    }

    if (lines.length === 0) {
      toast.error('تعذّر استرجاع الفاتورة — أصنافها لم تعد متاحة');
      return;
    }

    startRecall(async () => {
      const res = await discardParkedOrder({ id: order.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setCart(lines);
      setParkedOpen(false);
      if (missing.length > 0) {
        toast.warning(`تم الاسترجاع — تعذّر إرجاع: ${missing.join('، ')}`);
      } else {
        toast.success(res.message ?? 'تم استرجاع الفاتورة');
      }
      router.refresh();
    });
  }

  function resetCart() {
    setCart([]);
    setCustomerId('');
    setOrderDiscount(0);
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      customers={customers}
      customerId={customerId}
      setCustomerId={setCustomerId}
      orderDiscount={orderDiscount}
      setOrderDiscount={setOrderDiscount}
      subtotal={subtotal}
      total={total}
      onChangeQty={changeQty}
      onRemove={removeLine}
      onClear={resetCart}
      onCheckout={() => {
        setCartOpen(false);
        setCheckoutOpen(true);
      }}
      lastSale={lastSale}
      onDismissSale={() => setLastSale(null)}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] gap-4">
      {/* ── شبكة المنتجات ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!hasOpenRegister && (
          <div className="mb-3 rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn">
            لا توجد وردية صندوق مفتوحة — الفواتير لن تُربط بوردية، ولن يمكن تسوية النقدية آخر اليوم.
          </div>
        )}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--text-2)]" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="ابحث بالاسم أو الباركود… (امسح الباركود مباشرة)"
            aria-label="بحث عن منتج"
            autoFocus
            className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] ps-10 pe-4 text-sm text-[var(--text-0)] placeholder:text-[var(--text-2)] focus:border-accent focus:outline-none"
          />
        </div>

        {parkedOrders.length > 0 && (
          <button
            onClick={() => setParkedOpen(true)}
            className="mb-3 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-accent/35 bg-accent/[0.07] px-3.5 py-2.5 text-[13px] font-medium text-accent-soft hover:bg-accent/15"
          >
            <span className="flex items-center gap-2">
              <ReceiptText className="size-4" />
              فواتير معلّقة بانتظار الاستكمال
            </span>
            <span className="tnum rounded-full bg-accent/20 px-2 py-0.5">
              {parkedOrders.length}
            </span>
          </button>
        )}

        <div className="mb-3 flex flex-wrap gap-1.5">
          <CategoryChip
            label="الكل"
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          <CategoryChip
            label="الخدمات"
            active={activeCategory === 'services'}
            onClick={() => setActiveCategory('services')}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.nameAr}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-sm font-semibold text-[var(--text-1)]">لا توجد أصناف مطابقة</p>
                <p className="mt-1 text-[13px] text-[var(--text-2)]">
                  جرّب بحثاً آخر أو غيّر التصنيف
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const out = p.trackStock && p.stockQty <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className={cn(
                      'flex h-28 flex-col justify-between rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1)] p-3 text-start transition-all',
                      out
                        ? 'cursor-not-allowed opacity-45'
                        : 'hover:border-accent hover:bg-[var(--surface-2)] active:scale-[0.98]'
                    )}
                  >
                    <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--text-0)]">
                      {p.nameAr}
                    </span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="tnum text-sm font-bold text-accent">
                        {formatKWD(p.price)}
                      </span>
                      {p.trackStock ? (
                        <span
                          className={cn(
                            'tnum text-[11px]',
                            p.stockQty <= 0
                              ? 'text-danger'
                              : p.stockQty <= 5
                                ? 'text-warn'
                                : 'text-[var(--text-2)]'
                          )}
                        >
                          {p.stockQty} {p.unit}
                        </span>
                      ) : (
                        <Badge tone="info">خدمة</Badge>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── السلة — سطح المكتب ── */}
      <aside className="hidden w-80 shrink-0 lg:block">{cartPanel}</aside>

      {/* ── السلة — الجوال ── */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-40 flex h-14 items-center justify-between rounded-[var(--radius-md)] bg-accent px-5 text-[var(--accent-ink)] shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="size-5" />
            {cart.length} صنف
          </span>
          <span className="tnum text-lg font-bold">{formatKWD(total)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 w-[min(22rem,90vw)] bg-[var(--surface-0)] p-3 shadow-2xl">
            <button
              onClick={() => setCartOpen(false)}
              aria-label="إغلاق السلة"
              className="mb-2 rounded-full p-1.5 text-[var(--text-2)] hover:bg-[var(--glass-strong)]"
            >
              <X className="size-5" />
            </button>
            <div className="h-[calc(100%-3rem)]">{cartPanel}</div>
          </div>
        </div>
      )}

      {parkedOpen && (
        <Modal
          open
          onClose={() => setParkedOpen(false)}
          title="الفواتير المعلّقة"
          description="اختر فاتورة لإرجاع بنودها إلى السلة — سيُحذف الحفظ المعلّق"
          size="lg"
        >
          <ul className="space-y-2">
            {parkedOrders.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => recallParked(o)}
                  disabled={recalling}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-start transition-colors hover:border-accent disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="tnum block text-[13px] font-bold text-accent" dir="ltr">
                      {o.number}
                    </span>
                    <span className="block text-[12px] text-[var(--text-1)]">
                      {o.customerName ?? 'عميل نقدي'} · {o.items.length} صنف
                    </span>
                    <span className="tnum block text-[11px] text-[var(--text-2)]">
                      {o.createdAt}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[15px] font-bold text-[var(--text-0)]">
                    {formatKWD(o.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {checkoutOpen && (
        <CheckoutModal
          total={total}
          subtotal={subtotal}
          discount={orderDiscount}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={async (payments, notes, park) => {
            const res = await createPosOrder({
              customerId: customerId || null,
              items: cart.map((l) => ({
                productId: l.productId,
                label: l.label,
                qty: l.qty,
                unitPrice: l.unitPrice,
                discount: l.discount,
              })),
              discountAmount: orderDiscount,
              payments,
              notes,
              park,
            });

            if (res.ok) {
              toast.success(res.message ?? 'تم إصدار الفاتورة');
              resetCart();
              setCheckoutOpen(false);

              // المعلّقة ليست بيعاً مكتملاً — لا إيصال لها
              const parked = res.data?.parked === true;
              if (!parked && res.id) {
                setLastSale({ id: res.id, number: String(res.data?.number ?? '') });
              }

              router.refresh();
              return true;
            }
            toast.error(res.error);
            return false;
          }}
        />
      )}
    </div>
  );
}

/**
 * لوحة ما بعد البيع — تحلّ محل "السلة فارغة" حتى يبدأ الكاشير بيعاً جديداً.
 * الإيصال يُفتح في نافذة منفصلة بـ ‎?print=1‎ فيبقى الطرفية جاهزة للعميل التالي
 * بدل أن ينتقل الكاشير عن الشاشة ويعود.
 */
function LastSalePanel({
  sale,
  onDismiss,
}: {
  sale: { id: string; number: string };
  onDismiss: () => void;
}) {
  const receiptUrl = `/dashboard/invoices/${sale.id}?print=1`;

  return (
    <div className="grid h-full place-items-center px-4 text-center">
      <div className="w-full">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-ok/15">
          <Check className="size-6 text-ok" />
        </div>

        <p className="mt-3 text-[13px] font-semibold text-[var(--text-1)]">تمّ إصدار الفاتورة</p>
        {sale.number && (
          <p className="tnum mt-0.5 text-base font-bold text-[var(--text-0)]" dir="ltr">
            {sale.number}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <Button
            className="w-full"
            onClick={() => window.open(receiptUrl, '_blank', 'noopener')}
          >
            <Printer />
            طباعة الإيصال
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={onDismiss}>
            بيع جديد
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent-soft'
          : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)] hover:text-[var(--text-0)]'
      )}
    >
      {label}
    </button>
  );
}

function CartPanel({
  cart,
  customers,
  customerId,
  setCustomerId,
  orderDiscount,
  setOrderDiscount,
  subtotal,
  total,
  onChangeQty,
  onRemove,
  onClear,
  onCheckout,
  lastSale,
  onDismissSale,
}: {
  cart: CartLine[];
  customers: Array<{ id: string; name: string; phone: string }>;
  customerId: string;
  setCustomerId: (v: string) => void;
  orderDiscount: number;
  setOrderDiscount: (v: number) => void;
  subtotal: number;
  total: number;
  onChangeQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  lastSale: { id: string; number: string } | null;
  onDismissSale: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--text-0)]">
          <ShoppingCart className="size-4" />
          الفاتورة
          {cart.length > 0 && <Badge tone="accent">{cart.length}</Badge>}
        </h2>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="text-[12px] text-danger hover:underline"
          >
            تفريغ
          </button>
        )}
      </div>

      <div className="border-b border-[var(--line)] p-3">
        <Select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          aria-label="العميل"
        >
          <option value="">عميل نقدي (بدون تسجيل)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.phone}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 && lastSale ? (
          <LastSalePanel sale={lastSale} onDismiss={onDismissSale} />
        ) : cart.length === 0 ? (
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <ShoppingCart className="mx-auto size-8 text-[var(--text-2)] opacity-40" />
              <p className="mt-3 text-[13px] font-semibold text-[var(--text-1)]">السلة فارغة</p>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">
                اضغط على أي صنف لإضافته
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {cart.map((l) => (
              <li key={l.productId} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-snug text-[var(--text-0)]">
                    {l.label}
                  </p>
                  <button
                    onClick={() => onRemove(l.productId)}
                    aria-label={`حذف ${l.label}`}
                    className="shrink-0 text-[var(--text-2)] hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onChangeQty(l.productId, -1)}
                      aria-label="إنقاص الكمية"
                      className="grid size-7 place-items-center rounded-md border border-[var(--line)] text-[var(--text-1)] hover:border-[var(--line-strong)]"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="tnum w-9 text-center text-[13px] font-bold text-[var(--text-0)]">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => onChangeQty(l.productId, 1)}
                      aria-label="زيادة الكمية"
                      className="grid size-7 place-items-center rounded-md border border-[var(--line)] text-[var(--text-1)] hover:border-[var(--line-strong)]"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="tnum text-[13px] font-bold text-[var(--text-0)]">
                    {formatKWD(l.qty * l.unitPrice - l.discount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2.5 border-t border-[var(--line)] p-3.5">
        <div className="flex items-center justify-between text-[13px] text-[var(--text-1)]">
          <span>المجموع</span>
          <span className="tnum">{formatKWD(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label htmlFor="pos-discount" className="text-[13px] text-[var(--text-1)]">
            خصم
          </label>
          <Input
            id="pos-discount"
            type="number"
            step="0.001"
            min={0}
            max={subtotal}
            value={orderDiscount || ''}
            onChange={(e) => setOrderDiscount(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0.000"
            dir="ltr"
            className="tnum h-8 w-28 text-start"
          />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] pt-2.5">
          <span className="text-sm font-bold text-[var(--text-0)]">الإجمالي</span>
          <span className="tnum text-lg font-bold text-accent">{formatKWD(total)}</span>
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={cart.length === 0}
          onClick={onCheckout}
        >
          الدفع
        </Button>
      </div>
    </div>
  );
}

interface PaymentLine {
  method: 'CASH' | 'KNET' | 'VISA' | 'TRANSFER' | 'LINK' | 'CREDIT';
  amount: number;
  reference?: string | null;
}

function CheckoutModal({
  total,
  subtotal,
  discount,
  onClose,
  onConfirm,
}: {
  total: number;
  subtotal: number;
  discount: number;
  onClose: () => void;
  onConfirm: (payments: PaymentLine[], notes: string, park: boolean) => Promise<boolean>;
}) {
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [method, setMethod] = useState<PaymentLine['method']>('CASH');
  const [amount, setAmount] = useState<string>(total.toFixed(3));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  const settled = fils(lines.reduce((s, l) => s + l.amount, 0));
  const due = fils(Math.max(0, total - settled));
  const entered = Number(amount) || 0;
  // النقدي وحده يقبل الزيادة — الباقي يُعاد للعميل
  const change = method === 'CASH' ? fils(Math.max(0, entered - due)) : 0;

  function addLine() {
    if (entered <= 0) {
      toast.error('أدخل مبلغاً أكبر من صفر');
      return;
    }
    if (method !== 'CASH' && entered > due) {
      toast.error(`المتبقي ${due.toFixed(3)} د.ك فقط — الزيادة تُقبل نقداً فقط`);
      return;
    }

    // لا نسجّل أكثر من المستحق: الزيادة النقدية باقٍ للعميل لا دخل
    const recorded = fils(Math.min(entered, due));
    setLines((prev) => [...prev, { method, amount: recorded, reference: reference || null }]);
    setReference('');

    const nextDue = fils(due - recorded);
    setAmount(nextDue > 0 ? nextDue.toFixed(3) : '0.000');
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function submit(park: boolean) {
    // دفعة واحدة لم تُضَف بعد؟ نحتسبها لتفادي ضياعها بالسهو
    const pendingLine =
      !park && lines.length === 0 && entered > 0
        ? [{ method, amount: fils(Math.min(entered, total)), reference: reference || null }]
        : [];

    const all = [...lines, ...pendingLine];

    startTransition(async () => {
      await onConfirm(park ? [] : all, notes, park);
    });
  }

  const fullyPaid = due === 0 && lines.length > 0;
  const canConfirm = lines.length > 0 || entered > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="إتمام الدفع"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button variant="secondary" onClick={() => submit(true)} disabled={pending}>
            تعليق الفاتورة
          </Button>
          <Button onClick={() => submit(false)} disabled={pending || !canConfirm}>
            {pending && <Loader2 className="animate-spin" />}
            تأكيد الدفع
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
          <div className="flex items-center justify-between text-[13px] text-[var(--text-1)]">
            <span>المجموع</span>
            <span className="tnum">{formatKWD(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="mt-1.5 flex items-center justify-between text-[13px] text-warn">
              <span>الخصم</span>
              <span className="tnum">− {formatKWD(discount)}</span>
            </div>
          )}
          <div className="mt-2.5 flex items-center justify-between border-t border-[var(--line)] pt-2.5">
            <span className="font-bold text-[var(--text-0)]">المطلوب</span>
            <span className="tnum text-xl font-bold text-accent">{formatKWD(total)}</span>
          </div>
        </div>

        {/* الدفعات المسجّلة */}
        {lines.length > 0 && (
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <Badge tone={PAYMENT_METHOD[l.method].tone}>
                    {PAYMENT_METHOD[l.method].label}
                  </Badge>
                  {l.reference && (
                    <span className="tnum text-[11px] text-[var(--text-2)]" dir="ltr">
                      {l.reference}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tnum text-[13px] font-semibold text-[var(--text-0)]">
                    {formatKWD(l.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    aria-label="حذف الدفعة"
                    className="text-[var(--text-2)] hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {due > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="طريقة الدفع">
                <Select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentLine['method'])}
                >
                  {toOptions(PAYMENT_METHOD).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="المبلغ المستلم">
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  dir="ltr"
                  className="tnum text-start"
                  autoFocus
                />
              </Field>
            </div>

            {method !== 'CASH' && (
              <Field label="رقم العملية / المرجع">
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  dir="ltr"
                  className="text-start"
                  placeholder="رقم إيصال الشبكة…"
                />
              </Field>
            )}

            {method === 'CASH' && (
              <div className="flex flex-wrap gap-1.5">
                {[due, 5, 10, 20, 50].map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAmount(v.toFixed(3))}
                    className="tnum rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-1)] hover:border-accent hover:text-accent"
                  >
                    {i === 0 ? 'المبلغ بالضبط' : `${v} د.ك`}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] px-3.5 py-2.5">
              <span className="text-[13px] text-[var(--text-1)]">
                المتبقي على الفاتورة:{' '}
                <span className="tnum font-bold text-warn">{formatKWD(due)}</span>
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                <Plus />
                إضافة دفعة
              </Button>
            </div>

            <p className="text-[11px] text-[var(--text-2)]">
              لتقسيم الدفع (نقدي + كي نت مثلاً): أدخل مبلغ الأولى واضغط «إضافة دفعة»، ثم كرّر
              للباقي.
            </p>
          </>
        )}

        {change > 0 && (
          <div className="rounded-[var(--radius-sm)] border border-ok/30 bg-ok/10 px-3.5 py-2.5">
            <span className="text-[13px] text-ok">الباقي للعميل: </span>
            <span className="tnum text-base font-bold text-ok">{formatKWD(change)}</span>
          </div>
        )}

        {fullyPaid && (
          <div className="rounded-[var(--radius-sm)] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-[13px] font-semibold text-ok">
            ✓ الفاتورة مسدّدة بالكامل — اضغط تأكيد الدفع
          </div>
        )}

        {!fullyPaid && lines.length > 0 && (
          <div className="rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn">
            دفعة جزئية — سيبقى{' '}
            <span className="tnum font-bold">{formatKWD(due)}</span> مستحقاً على العميل، ويمكن
            تحصيله لاحقاً من صفحة الفاتورة.
          </div>
        )}

        <Field label="ملاحظات">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-16"
            placeholder="ملاحظات على الفاتورة…"
          />
        </Field>
      </div>
    </Modal>
  );
}
