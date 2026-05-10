import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { getProduct } from "./data";
import type { AccountSession, BookingDetails, CartItem, ContactSubmission, Coupon, CustomerInfo, Order } from "./types";
import { applyCoupon, calculateTotals, createOrder } from "./utils";

const keys = {
  cart: "chos.cart.v1",
  orders: "chos.orders.v1",
  bookings: "chos.bookings.v1",
  contacts: "chos.contacts.v1",
  session: "chos.session.v1",
  accounts: "chos.accounts.v1",
  coupon: "chos.coupon.v1"
} as const;

interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AccountRecord {
  email: string;
  createdAt: string;
}

interface AppState {
  cart: CartItem[];
  coupon?: Coupon;
  totals: ReturnType<typeof calculateTotals>;
  orders: Order[];
  bookings: BookingDetails[];
  contacts: ContactSubmission[];
  session?: AccountSession;
  accounts: AccountRecord[];
  toasts: Toast[];
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  dismissToast: (id: string) => void;
  addProductToCart: (productSlug: string, quantity: number) => void;
  addBookingToCart: (booking: BookingDetails) => void;
  updateCartQuantity: (id: string, quantity: number) => void;
  removeCartItem: (id: string) => void;
  clearCart: () => void;
  applyCartCoupon: (code: string) => Coupon;
  clearCoupon: () => void;
  placeOrder: (customer: CustomerInfo, notes: string) => Order;
  saveBooking: (booking: BookingDetails) => void;
  saveContact: (contact: ContactSubmission) => void;
  login: (email: string, remembered: boolean) => void;
  logout: () => void;
  register: (email: string) => void;
}

const Context = createContext<AppState | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStorage<T>(key, fallback));
  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  return [value, update] as const;
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useStoredState<CartItem[]>(keys.cart, []);
  const [orders, setOrders] = useStoredState<Order[]>(keys.orders, []);
  const [bookings, setBookings] = useStoredState<BookingDetails[]>(keys.bookings, []);
  const [contacts, setContacts] = useStoredState<ContactSubmission[]>(keys.contacts, []);
  const [session, setSession] = useStoredState<AccountSession | undefined>(keys.session, undefined);
  const [accounts, setAccounts] = useStoredState<AccountRecord[]>(keys.accounts, []);
  const [coupon, setCoupon] = useStoredState<Coupon | undefined>(keys.coupon, undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, message, actionLabel, onAction }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const totals = useMemo(() => calculateTotals(cart, coupon), [cart, coupon]);

  const addProductToCart = useCallback(
    (productSlug: string, quantity: number) => {
      const product = getProduct(productSlug);
      if (!product) return;
      setCart((current) => {
        const existing = current.find((item) => item.productSlug === productSlug && !item.booking);
        if (existing) {
          return current.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item));
        }
        return [
          ...current,
          {
            id: `cart-${productSlug}-${Date.now()}`,
            productSlug,
            name: product.name,
            unitPrice: product.price,
            displayPrice: product.displayPrice,
            quantity
          }
        ];
      });
    },
    [setCart]
  );

  const saveBooking = useCallback(
    (booking: BookingDetails) => {
      setBookings((current) => [...current, booking]);
    },
    [setBookings]
  );

  const addBookingToCart = useCallback(
    (booking: BookingDetails) => {
      const product = getProduct("starter-program");
      if (!product) return;
      setCart((current) => [
        ...current,
        {
          id: `booking-${Date.now()}`,
          productSlug: product.slug,
          name: `${product.name} - ${booking.date} ${booking.time}`,
          unitPrice: product.price * booking.persons,
          displayPrice: product.displayPrice,
          quantity: 1,
          booking
        }
      ]);
      saveBooking(booking);
    },
    [saveBooking, setCart]
  );

  const updateCartQuantity = useCallback(
    (id: string, quantity: number) => {
      setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)));
    },
    [setCart]
  );

  const removeCartItem = useCallback(
    (id: string) => {
      setCart((current) => current.filter((item) => item.id !== id));
    },
    [setCart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setCoupon(undefined);
  }, [setCart, setCoupon]);

  const applyCartCoupon = useCallback(
    (code: string) => {
      const nextCoupon = applyCoupon(code, calculateTotals(cart).subtotal);
      setCoupon(nextCoupon);
      return nextCoupon;
    },
    [cart, setCoupon]
  );

  const clearCoupon = useCallback(() => setCoupon(undefined), [setCoupon]);

  const placeOrder = useCallback(
    (customer: CustomerInfo, notes: string) => {
      const order = createOrder({ existingOrdersCount: orders.length, customer, items: cart, coupon, notes });
      setOrders((current) => [...current, order]);
      setCart([]);
      setCoupon(undefined);
      return order;
    },
    [cart, coupon, orders.length, setCart, setCoupon, setOrders]
  );

  const saveContact = useCallback(
    (contact: ContactSubmission) => {
      setContacts((current) => [...current, contact]);
    },
    [setContacts]
  );

  const login = useCallback(
    (email: string, remembered: boolean) => {
      setSession({ email, remembered, createdAt: new Date().toISOString() });
    },
    [setSession]
  );

  const logout = useCallback(() => setSession(undefined), [setSession]);

  const register = useCallback(
    (email: string) => {
      setAccounts((current) => (current.some((account) => account.email === email) ? current : [...current, { email, createdAt: new Date().toISOString() }]));
    },
    [setAccounts]
  );

  const value: AppState = {
    cart,
    coupon,
    totals,
    orders,
    bookings,
    contacts,
    session,
    accounts,
    toasts,
    showToast,
    dismissToast,
    addProductToCart,
    addBookingToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    applyCartCoupon,
    clearCoupon,
    placeOrder,
    saveBooking,
    saveContact,
    login,
    logout,
    register
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const value = useContext(Context);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
