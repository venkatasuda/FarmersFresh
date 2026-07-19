"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  unit: "kg" | "piece";
  /** Cached for display only. The database re-prices at checkout. */
  price: number;
  imagePath: string | null;
  quantity: number;
  /** "500 g", "5 kg", "1 L" — null for loose goods sold by weight. Cached so
   *  the basket reads "2 × 500 g" without refetching the product. */
  packLabel: string | null;
  /** Loose goods step by 500 g; packs step by 1. */
  step: number;
};

export type CartNotice = { id: number; name: string } | null;

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  ready: boolean;
  /** Set briefly whenever something is added, so a toast can show. */
  notice: CartNotice;
  dismissNotice: () => void;
  /** The slide-out basket drawer. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "ff.cart.v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState<CartNotice>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Nothing may read localStorage during render — the server has no such
  // object, and reading it in useState would break hydration. Load after mount
  // and use `ready` to avoid flashing an empty basket.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed as CartLine[]);
      }
    } catch {
      // Corrupt or blocked storage: start with an empty basket rather than
      // taking the whole shop down.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private browsing / quota. The basket still works for this visit.
    }
  }, [lines, ready]);

  const add = useCallback(
    (line: Omit<CartLine, "quantity">, quantity: number) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === line.productId);
        if (existing) {
          return prev.map((l) =>
            l.productId === line.productId
              ? { ...l, quantity: round3(l.quantity + quantity) }
              : l
          );
        }
        return [...prev, { ...line, quantity: round3(quantity) }];
      });
      // A monotonic id so re-adding the same item re-triggers the toast.
      setNotice({ id: Date.now(), name: line.name });
    },
    []
  );

  const dismissNotice = useCallback(() => setNotice(null), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) =>
            l.productId === productId ? { ...l, quantity: round3(quantity) } : l
          )
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartState>(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return {
      lines,
      add,
      setQuantity,
      remove,
      clear,
      count: lines.length,
      subtotal: Math.round(subtotal * 100) / 100,
      ready,
      notice,
      dismissNotice,
      drawerOpen,
      openDrawer,
      closeDrawer,
    };
  }, [
    lines,
    add,
    setQuantity,
    remove,
    clear,
    ready,
    notice,
    dismissNotice,
    drawerOpen,
    openDrawer,
    closeDrawer,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/** Weights are numeric(12,3) in the database — keep JS to 3 decimals too. */
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
