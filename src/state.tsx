import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { getProduct } from "./data";
import type { AccountRole, AccountSession, BookingDetails, CartItem, ChildAccount, ContactSubmission, Coupon, CustomerInfo, Order } from "./types";
import { applyCoupon, calculateTotals, createOrder } from "./utils";

const keys = {
  cart: "chos.cart.v1",
  orders: "chos.orders.v1",
  bookings: "chos.bookings.v1",
  contacts: "chos.contacts.v1",
  session: "chos.session.v1",
  accounts: "chos.accounts.v1",
  accountRoles: "chos.accountRoles.v1",
  childAccounts: "chos.childAccounts.v1",
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

interface AccountRoleRecord {
  email: string;
  role: AccountRole;
}

interface AppState {
  cart: CartItem[];
  coupon?: Coupon;
  totals: ReturnType<typeof calculateTotals>;
  orders: Order[];
  bookings: BookingDetails[];
  contacts: ContactSubmission[];
  session?: AccountSession;
  accountRole?: AccountRole;
  accounts: AccountRecord[];
  guardianChildren: ChildAccount[];
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
  loginChildAccount: (childId: string) => void;
  logout: () => void;
  register: (email: string) => void;
  setAccountRole: (role: AccountRole) => void;
  addChildAccount: (child: { name: string; age: string; beltSlug: string }) => ChildAccount | undefined;
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
  const [accountRoles, setAccountRoles] = useStoredState<AccountRoleRecord[]>(keys.accountRoles, []);
  const [childAccounts, setChildAccounts] = useStoredState<ChildAccount[]>(keys.childAccounts, []);
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
  const accountRole = useMemo(() => (session ? accountRoles.find((record) => record.email.toLowerCase() === session.email.toLowerCase())?.role : undefined), [accountRoles, session]);
  const guardianChildren = useMemo(
    () => (session ? childAccounts.filter((child) => child.parentEmail.toLowerCase() === session.email.toLowerCase()) : []),
    [childAccounts, session]
  );

  const saveRoleForEmail = useCallback(
    (email: string, role: AccountRole) => {
      setAccountRoles((current) => {
        const normalizedEmail = email.toLowerCase();
        const existing = current.some((record) => record.email.toLowerCase() === normalizedEmail);
        return existing ? current.map((record) => (record.email.toLowerCase() === normalizedEmail ? { ...record, role } : record)) : [...current, { email, role }];
      });
    },
    [setAccountRoles]
  );

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

  const setAccountRole = useCallback(
    (role: AccountRole) => {
      if (!session) return;
      saveRoleForEmail(session.email, role);
    },
    [saveRoleForEmail, session]
  );

  const addChildAccount = useCallback(
    (child: { name: string; age: string; beltSlug: string }) => {
      if (!session) return undefined;
      const cleanedName = child.name.trim();
      if (!cleanedName) return undefined;
      const usernameBase = cleanedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const username = `${usernameBase || "student"}.child`;
      const createdChild: ChildAccount = {
        id: `child-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        parentEmail: session.email,
        name: cleanedName,
        username,
        age: child.age.trim(),
        beltSlug: child.beltSlug,
        createdAt: new Date().toISOString()
      };
      setChildAccounts((current) => [...current, createdChild]);
      saveRoleForEmail(username, "student");
      return createdChild;
    },
    [saveRoleForEmail, session, setChildAccounts]
  );

  const loginChildAccount = useCallback(
    (childId: string) => {
      const child = childAccounts.find((item) => item.id === childId);
      if (!child) return;
      saveRoleForEmail(child.username, "student");
      setSession({ email: child.username, remembered: true, createdAt: new Date().toISOString() });
    },
    [childAccounts, saveRoleForEmail, setSession]
  );

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
    accountRole,
    accounts,
    guardianChildren,
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
    loginChildAccount,
    logout,
    register,
    setAccountRole,
    addChildAccount
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
