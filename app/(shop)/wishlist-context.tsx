"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Favourites, kept in localStorage so they work for guests and survive across
 * visits — no account needed. A tiny context so the heart on a card and the
 * count in the header stay in sync.
 */
type WishlistState = {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
  ready: boolean;
};

const WishlistContext = createContext<WishlistState | null>(null);
const KEY = "ff.wishlist.v1";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setIds(parsed as string[]);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [ids, ready]);

  const toggle = useCallback((id: string) => {
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
    );
  }, []);

  const value = useMemo<WishlistState>(
    () => ({
      ids,
      has: (id: string) => ids.includes(id),
      toggle,
      count: ids.length,
      ready,
    }),
    [ids, toggle, ready]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}
